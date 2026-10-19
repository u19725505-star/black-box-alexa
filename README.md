# Black Box for Alexa+

**A flight recorder and undo layer for agentic Alexa+ actions, built as a real MCP server.**

As voice assistants start buying, booking and adjusting things on our behalf, people need to answer three questions: *What did it just do? Why? Can I take it back?* Black Box is an MCP server plus a simulated Alexa+ experience that answers all three.

- **Live demo:** https://u19725505-star.github.io/black-box-alexa/
- **Live MCP server:** `https://black-box-alexa.onrender.com/mcp` (Streamable HTTP, protocol 2025-11-25). It runs on a free tier, so the first request after a quiet period can take up to a minute.
- **Track:** Alexa+ (simulated Alexa+ experience in a web app, with a real MCP server behind it)
- **Mini challenge:** Open Source (MIT)

## Who it is for

A household where one Alexa+ account acts for several people: it can place orders, change the thermostat and book events. When a $79 order appears, someone will ask who approved it and why. Black Box gives them an answer they can verify, plus a way to reverse it and rules that stop it from happening again, such as a spending limit and quiet hours.

## What it does

1. **Tamper-evident ledger.** Every action the assistant takes, holds or blocks is written to a hash-chained log. Each entry stores a SHA-256 fingerprint of its contents and the previous entry's fingerprint, so changing any past record breaks the chain at that exact entry.
2. **"Why did you do that?"** Ask in the chat or tap **Why?** on any entry. Black Box replays what you said, the reason, the status and the fingerprint.
3. **Undo.** "Undo the last 2" reverses the most recent undoable actions. The undo itself is recorded as new entries, so history is never rewritten.
4. **Guardrails.** A spending limit holds large orders until you say "confirm" or "cancel", and quiet hours block thermostat changes at night. Held and blocked attempts are logged with the reason.
5. **Tamper demo.** One button edits an old record after the fact. Verification then reports exactly which entry is broken.

## How it works

The web app is an **MCP client**. It sends its actions to the Black Box MCP server over Streamable HTTP (JSON-RPC), and the **Ledger** tab shows a live **MCP traffic** card with every call, its timing and its result.

| MCP tool | What it does |
|---|---|
| `check_action` | Evaluates an action against the guardrails and returns allow, hold or block with the reason |
| `record_action` | Appends a hash-chained entry to the ledger |
| `explain_action` | Returns the request, reason, status and fingerprint for an entry |
| `undo_action` | Marks the most recent undoable actions as undone and logs each reversal |
| `set_guardrail` | Sets the spending limit and quiet hours |
| `verify_chain` | Recomputes every hash and reports the first broken entry |
| `list_ledger` | Returns all entries and the current guardrails |
| `demo_tamper` | Demo only: edits a record without re-hashing it |
| `demo_reset` | Demo only: clears the ledger and restores default guardrails |

## Try it

Open the live demo and tap **Run demo** for a narrated walkthrough, or type these in the Assistant tab:

1. `Order groceries $18` (within the limit, goes through)
2. `Order headphones $79` (held), then `confirm`
3. `Set thermostat to 66`
4. `Why did you do that?`
5. `Undo the last 2`
6. Turn on night in the Guardrails tab, then `Set thermostat to 66` (blocked by quiet hours)
7. In the Ledger tab tap **Verify chain** (intact), then **Tamper demo**, then **Verify chain** again (broken at the edited entry)
8. Scroll down in the Ledger tab to see the MCP traffic card

## Test the MCP server

Open https://u19725505-star.github.io/black-box-alexa/mcptest.html and tap **Run MCP test**. It calls the live server and checks initialize, tools/list, both guardrail decisions, record, verify, explain, undo and tamper detection.

## Run locally

Requires Node 18 or newer.

```bash
npm install
npm start
```

The server listens on port 3000 (or `PORT`). The MCP endpoint is `POST /mcp` and a health check is at `/health`. To point the web app at your local server, change `MCP_URL` at the top of `mcp.js`.

## Project layout

| File | Purpose |
|---|---|
| `server.js`, `package.json` | The MCP server (Node, Express, official MCP TypeScript SDK 1.29.0, zod), stateless Streamable HTTP |
| `index.html`, `style.css` | The simulated Alexa+ interface |
| `core.js`, `ui.js`, `main.js` | Simulation logic, rendering and wiring (plain JavaScript, no framework) |
| `mcp.js` | The MCP client that mirrors the app's actions to the server and draws the traffic card |
| `mcptest.html` | Smoke test for the live server |

## Honest scope

- This is a **simulated Alexa+ experience**, as allowed by the hackathon's Alexa+ track. It does not call the real Alexa+ service, and the orders, thermostat and calendar are simulated.
- In this build the UI makes the hold and block decisions itself, and calls the server's `check_action` alongside it. In the demo the server's verdict matches. Making the server the single decision-maker is the natural next step.
- The web app and the server each keep a hash-chained ledger, and the app mirrors every entry to the server. The server's ledger is held in memory and resets when the server restarts.
- Replies are spoken with the browser's speech synthesis. There is no voice input: browser speech recognition fails on iPadOS with an Apple speech-service error (`kAFAssistantErrorDomain` 1107), so input is typed.

## Built during the hackathon

All code in this repository was created during the submission window.

## License

MIT
