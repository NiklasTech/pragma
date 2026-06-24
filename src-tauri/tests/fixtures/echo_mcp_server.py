#!/usr/bin/env python3
"""Minimal MCP stdio server for integration tests.

Exposes a single `echo` tool that returns its input.
"""
import json
import sys


def send_response(req_id, result):
    response = {"jsonrpc": "2.0", "id": req_id, "result": result}
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = msg.get("method")
        req_id = msg.get("id")

        if method == "initialize":
            send_response(
                req_id,
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "serverInfo": {"name": "echo", "version": "1.0.0"},
                },
            )
        elif method == "tools/list":
            send_response(
                req_id,
                {
                    "tools": [
                        {
                            "name": "echo",
                            "description": "Echoes the provided message",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "message": {"type": "string"}
                                },
                                "required": ["message"],
                            },
                        }
                    ]
                },
            )
        elif method == "tools/call":
            args = msg.get("params", {}).get("arguments", {})
            message = args.get("message", "")
            send_response(
                req_id,
                {
                    "content": [
                        {"type": "text", "text": f"echo: {message}"}
                    ]
                },
            )


if __name__ == "__main__":
    main()
