import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/* ---------- Black Box state (in memory, resets on restart) ---------- */
let ledger = [];
let nextId = 1;
const rails = { limit: 25, quiet: true };
const UNDOABLE = new Set(['place_order', 'set_thermostat', 'add_event']);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fp = (e, prev) =>
  JSON.stringify([e.id, e.ts, e.tool, e.args, e.request, e.reason, e.status, prev]);

function append({ tool, args = {}, request, reason, status = 'done' }) {
  const prev = ledger.length ? ledger[ledger.length - 1].hash : 'GENESIS';
  const e = {
    id: nextId++,
    ts: new Date().toISOString(),
    tool,
    args,
    request,
    reason,
    status,
  };
  e.prev = prev;
  e.hash = sha(fp(e, prev));
  e.undone = false;
  ledger.push(e);
  return e;
}

function verifyChain() {
  let prev = 'GENESIS';
  for (const e of ledger) {
    if (e.prev !== prev || e.hash !== sha(fp(e, prev))) {
      return { intact: false, brokenAt: e.id, entries: ledger.length };
    }
    prev = e.hash;
  }
  return { intact: true, brokenAt: 0, entries: ledger.length };
}

const out = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

/* ---------- MCP tools exposed to compatible clients; no direct Alexa+ integration ---------- */
function buildServer() {
  const server = new McpServer({ name: 'black-box-alexa', version: '1.0.0' });

  server.registerTool(
    'check_action',
    {
      title: 'Check an action against guardrails',
      description:
        'Call BEFORE an agentic action runs. Returns allow, hold (needs user confirmation) or block, with the reason.',
      inputSchema: {
        tool: z.string().describe('Action name, e.g. place_order or set_thermostat'),
        amount: z.number().optional().describe('Dollar amount for purchases'),
        night: z.boolean().optional().describe('True if it is currently quiet-hours time'),
      },
    },
    async ({ tool, amount, night }) => {
      if (tool === 'place_order' && typeof amount === 'number' && amount > rails.limit) {
        return out({
          decision: 'hold',
          reason: `Total $${amount} is over the $${rails.limit} limit. Ask the user to confirm.`,
        });
      }
      if (tool === 'set_thermostat' && rails.quiet && night) {
        return out({
          decision: 'block',
          reason: 'Blocked by quiet-hours guardrail (no thermostat changes at night).',
        });
      }
      return out({ decision: 'allow', reason: 'No guardrail applies.' });
    }
  );

  server.registerTool(
    'record_action',
    {
      title: 'Record an action in the ledger',
      description:
        'Append a hash-chained entry for any action the assistant took, held, blocked or was declined.',
      inputSchema: {
        tool: z.string(),
        args: z.record(z.any()).optional(),
        request: z.string().describe('What the user said'),
        reason: z.string().describe('Why the assistant acted this way'),
        status: z.enum(['done', 'held', 'blocked', 'declined']).optional(),
      },
    },
    async (a) => out({ entry: append(a) })
  );

  server.registerTool(
    'explain_action',
    {
      title: 'Explain an action',
      description:
        'Answer "why did you do that?" for one entry (omit id for the most recent one).',
      inputSchema: { id: z.number().optional() },
    },
    async ({ id }) => {
      const e = id ? ledger.find((x) => x.id === id) : ledger[ledger.length - 1];
      return out(e ? { found: true, entry: e } : { found: false });
    }
  );

  server.registerTool(
    'undo_action',
    {
      title: 'Undo recent actions',
      description:
        'Mark the most recent undoable completed actions as undone and log each reversal. Returns which actions the caller should reverse.',
      inputSchema: { count: z.number().int().min(1).max(10).optional() },
    },
    async ({ count = 1 }) => {
      const targets = [...ledger]
        .reverse()
        .filter((e) => e.status === 'done' && UNDOABLE.has(e.tool) && !e.undone)
        .slice(0, count);
      for (const e of targets) {
        e.undone = true;
        append({
          tool: 'undo_action',
          args: { target: e.id },
          request: 'undo',
          reason: `Reversed #${e.id} (${e.tool}) at the user's request.`,
        });
      }
      return out({
        undone: targets.map((e) => ({ id: e.id, tool: e.tool, args: e.args })),
      });
    }
  );

  server.registerTool(
    'set_guardrail',
    {
      title: 'Set a guardrail',
      description: 'Set the spending limit (dollars) and/or turn quiet hours on or off.',
      inputSchema: { limit: z.number().optional(), quiet: z.boolean().optional() },
    },
    async ({ limit, quiet }) => {
      if (typeof limit === 'number') rails.limit = limit;
      if (typeof quiet === 'boolean') rails.quiet = quiet;
      const e = append({
        tool: 'set_guardrail',
        args: { limit, quiet },
        request: 'guardrail change',
        reason: `Guardrails are now: limit $${rails.limit}, quiet hours ${rails.quiet ? 'on' : 'off'}.`,
      });
      return out({ guardrails: { ...rails }, entry: e });
    }
  );

  server.registerTool(
    'verify_chain',
    {
      title: 'Verify the ledger',
      description: 'Recompute every hash. Reports the first entry where the chain is broken.',
      inputSchema: {},
    },
    async () => out(verifyChain())
  );

  server.registerTool(
    'list_ledger',
    {
      title: 'List the ledger',
      description: 'Return all ledger entries and the current guardrails.',
      inputSchema: {},
    },
    async () => out({ entries: ledger, guardrails: { ...rails } })
  );

  server.registerTool(
    'demo_tamper',
    {
      title: 'DEMO ONLY: tamper with a record',
      description:
        'Edits an old record without re-hashing it so verify_chain can show the break. For demos only.',
      inputSchema: {},
    },
    async () => {
      const e = ledger.find((x) => x.tool === 'place_order') || ledger[0];
      if (!e) return out({ tampered: false });
      e.request = e.request + ' (edited later)';
      return out({ tampered: true, id: e.id });
    }
  );

  server.registerTool(
    'demo_reset',
    {
      title: 'DEMO ONLY: reset the ledger',
      description: 'Clear the ledger and restore default guardrails.',
      inputSchema: {},
    },
    async () => {
      ledger = [];
      nextId = 1;
      rails.limit = 25;
      rails.quiet = true;
      return out({ reset: true });
    }
  );

  return server;
}

/* ---------- Streamable HTTP endpoint (stateless) ---------- */
const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

const notAllowed = (req, res) =>
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Use POST /mcp.' },
    id: null,
  });
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

app.get('/', (req, res) =>
  res.json({
    name: 'black-box-alexa',
    transport: 'Streamable HTTP',
    endpoint: '/mcp',
    status: 'ok',
  })
);
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Black Box MCP server listening on port ${PORT}`));
