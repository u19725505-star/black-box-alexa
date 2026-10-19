# Black Box for Alexa+

**A simulated assistant experience and MCP server for exploring action guardrails, explanations, undo workflows, and hash-chain verification.**

When an assistant can take actions, users need to understand what was requested, what the prototype decided, what was recorded, and whether a record was changed afterward. Black Box is a browser-based simulation paired with a Node.js Model Context Protocol (MCP) server. It is a prototype for exploring these ideas—not an integration with the real Alexa+ service.

- **Web demo:** https://u19725505-star.github.io/black-box-alexa/
- **MCP endpoint:** https://black-box-alexa.onrender.com/mcp
- **MCP test page:** https://u19725505-star.github.io/black-box-alexa/mcptest.html
- **License:** MIT

## What the prototype demonstrates

- **Simulated assistant actions:** Type requests to place a mock order, change a simulated thermostat, or add a calendar event. No real purchases, devices, or calendar accounts are used.
- **Configurable demo guardrails:** Set a spending threshold and enable quiet hours. In the browser simulation, orders over the threshold are held for typed confirmation; thermostat changes are blocked when quiet hours and simulated night mode are both on.
- **Action explanations:** Ask “Why did you do that?” or select **Why?** on a ledger entry to see the request, reason, status, and hash information.
- **Undo in the simulation:** Undo recent completed simulated actions such as orders, thermostat changes, and calendar events. Undo operations are shown as additional local ledger entries.
- **Hash-chain verification:** Each ledger entry includes a SHA-256 hash and the previous entry's hash. The verification control recomputes the chain and identifies the first entry that no longer verifies.
- **Tamper demonstration:** The demo edits a stored request without recalculating its hash, then shows the verification failure.
- **MCP server and traffic panel:** The browser connects to the deployed MCP endpoint, lists available tools, and queues server calls. The Ledger tab adds a panel showing recent MCP calls, durations, and results.
- **Speech output:** The browser may read assistant responses aloud using its speech-synthesis support. Input is typed; speech recognition is not implemented in this prototype.

## Judge quick start — follow these steps in order

**Expected time: 3–5 minutes.** The server is already hosted on Render; judges do not need to upload or install it.

### 1. Open the live website

Go to the [Black Box for Alexa+ web demo](https://u19725505-star.github.io/black-box-alexa/). Near the top, find **Connect the MCP server**. If you do not see the connection panel, refresh the page once to load the latest version.

### 2. Connect to the remote MCP server

Tap **Connect to MCP server** and wait for the status to change to **Connected**. The panel should show the number of discovered tools and a list of tool names. The first request can take up to a minute if the free hosted service is waking from sleep.

If the connection fails, tap **Retry connection** once. If it still fails, continue to the [standalone MCP test page](https://u19725505-star.github.io/black-box-alexa/mcptest.html) to capture the diagnostic result; the endpoint is `https://black-box-alexa.onrender.com/mcp`.

### 3. Run the assistant demo

Tap **Run demo**, or open the **Assistant** tab and enter these requests one at a time:

1. `Order groceries $18` — a low-value simulated purchase.
2. `Order headphones $79` — should be held by the default $25 spending rule.
3. Type `confirm` if you want to demonstrate the approval flow.
4. `Set thermostat to 66` — a simulated thermostat action.
5. `Book dinner Friday 7pm` — a simulated calendar action.
6. `Why did you do that?` — asks for an explanation of the latest action.
7. `Undo the last 2` — demonstrates the simulated undo workflow.

These are examples for the prototype, not real purchases, device commands, or calendar bookings.

### 4. Demonstrate the guardrails

Open **Guardrails** and review the spending threshold and quiet-hours setting. Enable simulated night mode and quiet hours, then try `Set thermostat to 66`. The expected result is a blocked simulated action with an explanation. Return to the Guardrails tab to restore settings if needed.

### 5. Inspect the ledger and verify integrity

Open **Ledger** and review the recorded actions, their statuses, and explanations. Run **Verify chain** to check the local ledger. Then run **Tamper demo** followed by **Verify chain** again; the intentional edit should be detected. Reset the local demo afterward if you want a clean presentation.

### 6. Run the separate live MCP test (recommended evidence)

Open the [MCP test page](https://u19725505-star.github.io/black-box-alexa/mcptest.html) and tap **Run MCP test**. This directly calls the hosted server and tests initialization, tool discovery, policy decisions, server-ledger recording, explanation, undo, hash verification, and tamper detection. A successful run ends with **ALL TESTS PASSED**.

**Important:** the MCP test page calls the shared server's `demo_reset` and `demo_tamper` tools. It clears and intentionally modifies the server's demo ledger during the test, so do not run it while another judge is using the shared server. It resets the server ledger at the end of a successful run.

### What judges should verify

- The main website explicitly reports a successful MCP connection and displays discovered tools.
- The high-value purchase and quiet-hours scenario produce the expected policy decisions.
- The app explains actions and shows local ledger verification results.
- The standalone test page reports its individual checks and final result.
- The demo is clearly labeled as simulated and does not claim to control real Alexa+, devices, shopping, or calendars.


## MCP server

The server is implemented in Node.js using Express, the official Model Context Protocol TypeScript SDK, and Zod. It exposes a Streamable HTTP endpoint at `POST /mcp` and a health endpoint at `GET /health`. The server uses JSON-RPC MCP requests and registers the following tools:

| Tool | Purpose |
|---|---|
| `check_action` | Returns `allow`, `hold`, or `block` based on the server's current spending limit and quiet-hours settings. |
| `record_action` | Appends an action record to the server's hash-chained ledger. |
| `explain_action` | Returns a selected or most recent server-ledger entry. |
| `undo_action` | Marks eligible server-ledger entries as undone and appends reversal records; returns the actions the caller should reverse. It does not itself operate a real device or external service. |
| `set_guardrail` | Updates the server's spending limit and/or quiet-hours setting and records the change. |
| `verify_chain` | Recomputes the server ledger's hashes and reports whether the chain verifies. |
| `list_ledger` | Returns server-ledger entries and current server guardrails. |
| `demo_tamper` | Demo-only tool that changes a server-ledger request without recalculating its hash. |
| `demo_reset` | Demo-only tool that clears the server ledger and restores default guardrails. |

The browser's MCP client sends an `initialize` request using protocol version `2025-11-25`, then calls `tools/list` and `tools/call`. The server is configured for stateless Streamable HTTP transport. The server's ledger and guardrails are held in process memory, so they reset when the server restarts.

## Test the deployed MCP server

Open the [MCP test page](https://u19725505-star.github.io/black-box-alexa/mcptest.html) and tap **Run MCP test**. The page exercises initialization, tool discovery, spending and quiet-hours decisions, recording, verification, explanation, undo, tamper detection, and reset against the deployed endpoint.

The test page is a manual smoke test, not a comprehensive automated test suite. It calls the shared live server and uses the demo reset/tamper tools, so avoid running it while another person is relying on that server's demo state.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm start
```

The server listens on port `3000`, or the port supplied by the `PORT` environment variable.

- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

The static web app consists of `index.html`, `style.css`, and the browser JavaScript files. To use a local server, change the `MCP_URL` constant near the top of `mcp.js` to `http://localhost:3000/mcp`. When testing locally, serve the static files from a local HTTP server rather than opening the HTML file directly.

## Repository map

| File | Role |
|---|---|
| `index.html` | Page structure, tabs, controls, and script loading. |
| `style.css` | Responsive layout, visual styling, and animations. |
| `core.js` | Browser-side state, simulated actions, local ledger, hashing, speech synthesis, and local undo behavior. |
| `main.js` | Typed command parsing, browser-side guardrail decisions, demo narration, and UI event wiring. |
| `ui.js` | Rendering for the ledger, simulated home, guardrails, chain verification, tamper demo, and reset. |
| `mcp.js` | Browser MCP client, server-call queue, MCP traffic panel, and mirroring of selected local events. |
| `server.js` | MCP server, tools, in-memory server ledger and guardrails, HTTP endpoint, and health route. |
| `mcptest.html` | Manual browser-based smoke test for the deployed MCP endpoint. |
| `package.json` | Node package metadata, start command, and dependencies. |
| `.gitignore` | Ignore rules for dependencies, build output, logs, and local environment files. |
| `LICENSE` | MIT license. |

## Current limitations and security boundaries

This section is important when evaluating the prototype:

- **Not connected to Alexa+.** The UI is a simulation. The project does not invoke the real Alexa+ service or connect to a real Amazon account, shopping service, thermostat, or calendar.
- **The server policy gates simulated execution.** Before a simulated order, thermostat change, or calendar event is applied, the browser waits for `check_action`. A `block` prevents execution; a `hold` requires the user to type a confirmation; a confirmed over-limit purchase is rechecked with an approval flag. If the policy call fails or returns an invalid decision, the browser does not execute the action. The server currently trusts that flag from its caller; it is not a cryptographically authenticated human-approval protocol. This gate applies to the browser simulation, not to real Alexa+ or external services.
- **Two independent ledgers.** The browser and server each maintain their own ledger and guardrail state. Calls are queued and mirrored for demonstration, but their entries and IDs are not a single authoritative record and can diverge.
- **Undo is simulated.** The browser reverses its own in-memory demo state. The server tool marks eligible server-ledger records as undone and returns targets; it cannot reverse an external action by itself.
- **Hash-chain integrity has a limited scope.** Hashes detect edits to fields included in the fingerprint when the chain is verified. The current fingerprint includes the entry ID, timestamp, tool, arguments, request, reason, status, and previous hash. It does not include the separate `undone` flag. A hash chain alone does not provide authenticated identity, durable storage, or protection against an operator who can rewrite the whole ledger and recompute hashes.
- **Demo tools are destructive.** `demo_reset` clears the server ledger and restores default guardrails; `demo_tamper` intentionally edits a record. They are exposed by this demo server without authentication and must not be treated as production-safe administrative endpoints.
- **In-memory state is temporary.** Server ledger and guardrail state reset on server restart. The browser ledger and simulated home state are in page memory and reset when the app is reset or reloaded.
- **No speech input.** Responses can use browser speech synthesis, but commands are entered by typing. Speech recognition is not implemented.

The next engineering steps are to authenticate policy requests and approval signals, add durable storage, protect destructive demo tools, and include all mutable state in integrity verification. The current gate protects the browser simulation only; it is not a security boundary for real services.

## Built during the hackathon

The project is intended as a hackathon prototype and is licensed under MIT.

## License

MIT. See [LICENSE](LICENSE).
