# Black Box for Alexa+

**A flight recorder and undo layer for agentic Alexa+ actions.**

As voice assistants start buying, booking and adjusting things on our behalf, people need to be able to answer three questions: *What did it just do? Why? Can I take it back?* Black Box is an MCP-style tool layer that answers all three.

**Live demo:** https://u19725505-star.github.io/black-box-alexa/

**Track:** Alexa+ (simulated Alexa+ experience in a web app) · **Mini challenge:** Open Source (MIT)

## What it does

1. **Tamper-evident ledger.** Every action the assistant takes is written to a hash-chained log. Each entry stores a SHA-256 fingerprint of its contents plus the previous entry's fingerprint, so changing any past record breaks the chain at that exact entry.
2. **"Why did you do that?"** Ask by voice or text, or tap "Why?" on any entry. Black Box replays what you said, the reason for the action, its status and its fingerprint.
3. **Undo.** "Undo the last 2" reverses the most recent undoable actions. The undo itself is recorded as new ledger entries, so history is never rewritten.
4. **Guardrails.** Rules you set are enforced before an action runs:
   - Spending limit: orders over your limit are held until you say "confirm" or "cancel".
   - Quiet hours: thermostat changes are blocked at night.
   Held and blocked attempts are logged too, with the reason.

## Tools (the layer an Alexa+ MCP server would expose)

| Tool | Purpose |
|---|---|
| `record_action` | Append a hash-chained entry for any action |
| `explain_action` | Return the request, reason, status and fingerprint for an entry |
| `undo_action` | Reverse recent actions and log the reversal |
| `set_guardrail` | Set the spending limit or quiet hours |
| `verify_chain` | Recompute every hash and report the first broken entry |

Simulated agent actions used for the demo: `place_order`, `set_thermostat`, `add_event`.

## Try it

Open the live demo and run, in order:

1. `Order groceries $18` (within the limit, goes through)
2. `Order headphones $79` (held), then `confirm`
3. `Set thermostat to 66`
4. `Why did you do that?`
5. `Undo the last 2`
6. Toggle day / night to 11:00 PM, then `Set thermostat to 66` (blocked by quiet hours)
7. Tap **Verify chain** (intact), then **Tamper demo**, then **Verify chain** again (broken at the edited entry)

## Run locally

It is a single static file with no dependencies. Open `index.html` in any modern browser.

## Honest scope

This is a **simulated Alexa+ experience**, as allowed by the hackathon's Alexa+ track. It does not call the real Alexa+ service or any real devices, stores, thermostats or calendars. The ledger lives in browser memory and resets on reload. A production version would expose the tools above from a self-hosted MCP server (Streamable HTTP) and persist the ledger server-side.

## Built during the hackathon

All code in this repository was created during the submission window.

## License

MIT
