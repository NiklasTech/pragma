# Security Policy

## Supported Versions

Only the latest version on the `main` branch is actively supported with security updates. Once we publish releases, supported versions will be listed here.

| Version       | Supported |
| ------------- | --------- |
| latest `main` | ✅        |
| older commits | ❌        |

## Reporting a Vulnerability

If you discover a security vulnerability in Pragma, please report it privately rather than opening a public issue.

**Contact:** security@pragma-ide.dev

Please include:

- A clear description of the vulnerability
- Steps to reproduce
- Affected versions or commit range
- Possible impact
- Suggested fix (if any)

We aim to respond within 72 hours and will keep you informed throughout the disclosure process.

## Scope

Vulnerabilities we are interested in include, but are not limited to:

- Unsafe handling of API keys or credentials
- Arbitrary code execution through file parsing or AI integration
- Injection vulnerabilities in the terminal or shell integration
- Privilege escalation in Tauri commands
- Remote code execution via MCP server configuration

## Disclosure Policy

1. Reporter submits vulnerability privately.
2. Maintainers acknowledge receipt and begin investigation.
3. A fix is developed and tested.
4. A security advisory is published after a fix is available.
5. Reporter is credited unless they prefer to remain anonymous.

Thank you for helping keep Pragma and its users safe.
