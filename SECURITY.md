# Security Policy

## Supported versions

Only the latest release of Pragma receives security fixes. Older versions are not patched.

| Version | Supported |
| ------- | --------- |
| Latest  | ✓         |
| Older   | ✗         |

---

## Reporting a vulnerability

**Do not file security issues publicly on GitHub.**

Report vulnerabilities by email to **info@nh-webdev.de** with the subject line `[SECURITY] Pragma — <short description>`.

Include in your report:

- A clear description of the vulnerability
- Steps to reproduce or a proof of concept
- The potential impact (what an attacker could do)
- Your environment (OS, Pragma version, Rust/Node versions if relevant)

You will receive an acknowledgment within **72 hours**. If you don't hear back within that window, follow up to the same address.

---

## What to expect

- Vulnerabilities are assessed within 7 days of acknowledgment
- You will be kept informed as the issue is investigated and fixed
- A fix will be released as soon as reasonably possible depending on severity
- You will be credited in the release notes unless you prefer to remain anonymous

---

## Scope

Areas of particular concern for Pragma given its architecture:

- **AI tool surface** — anything the AI agent can invoke via MCP or internal tools
- **IPC command surface** — Tauri commands exposed to the webview
- **Filesystem access** — workspace authorization, path traversal, symlink handling
- **PTY / shell spawn** — shell injection, environment variable leakage
- **MCP server communication** — JSON-RPC surface, server lifecycle
- **Network paths** — AI provider requests, proxy handling, SSRF
- **API key handling** — storage, transmission, exposure in logs or UI

---

## Out of scope

- Vulnerabilities in third-party dependencies should be reported to the respective upstream project; mention them to us if you believe Pragma is specifically affected
- Issues that require physical access to the machine
- Social engineering

---

## Disclosure policy

Pragma follows **coordinated disclosure**. Please allow a reasonable time to fix and release before publishing your findings publicly. We aim to resolve critical issues within 14 days.
