<h1 align="center">🛰️ Black Box for Alexa+</h1>

<p align="center">
  <strong>Every AI action deserves a flight recorder.</strong><br>
  See it · Explain it · Undo it · Prove it
</p>

<p align="center">
  <a href="https://u19725505-star.github.io/black-box-alexa/"><strong>▶ OPEN LIVE DEMO</strong></a>
  &nbsp;·&nbsp;
  <a href="https://www.youtube.com/watch?v=lWHUGFvwmRw"><strong>WATCH THE VIDEO</strong></a>
  &nbsp;·&nbsp;
  <a href="https://u19725505-star.github.io/black-box-alexa/mcptest.html"><strong>RUN THE MCP TEST</strong></a>
  &nbsp;·&nbsp;
  <a href="https://black-box-alexa.onrender.com/health"><strong>SERVER HEALTH</strong></a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2563eb">
  <img alt="Node.js 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933">
  <img alt="MCP Streamable HTTP" src="https://img.shields.io/badge/MCP-Streamable%20HTTP-7c3aed">
  <img alt="9 MCP tools" src="https://img.shields.io/badge/MCP%20tools-9-0ea5e9">
  <img alt="Simulated Alexa+" src="https://img.shields.io/badge/Alexa%2B-simulated%20experience-f59e0b">
  <img alt="Status" src="https://img.shields.io/badge/status-hackathon%20prototype-orange">
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=lWHUGFvwmRw">
    <img src="https://img.youtube.com/vi/lWHUGFvwmRw/hqdefault.jpg" alt="Watch the Black Box for Alexa+ demo on YouTube" width="560">
  </a>
</p>

---

## The problem

Voice assistants are starting to **buy, book and adjust things on our behalf**. When an agent acts for you, three questions matter:

> **What did it just do?  Why did it do it?  Can I take it back?**

Today, most assistants cannot answer all three. Black Box can.

## The idea

Black Box is a **flight recorder and policy gate** for agentic assistants. It sits between a request and its action, and it is built as a live **Model Context Protocol (MCP) server** that any MCP-compatible agent could call.

| | What you get | How |
|---|---|---|
| 👁️ **See it** | Every request becomes a visible decision: `allow`, `hold` or `block` | A policy check runs *before* the action |
| 💬 **Explain it** | "Why did you do that?" gets a real answer | Request, reason, status and fingerprint replayed for any entry |
| ↩️ **Undo it** | "Undo
