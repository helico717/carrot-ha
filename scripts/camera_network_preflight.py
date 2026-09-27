"""Check HA HTTPS/WebSocket reachability without credentials or camera access."""
import asyncio
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit, urlunsplit


def configure_comma_imports(root=Path("/data/openpilot")):
    """Use the same bundled library directory as the installed collector."""
    paths = [str(path) for path in (root, root / "pydeps") if path.is_dir()]
    sys.path[:0] = [path for path in paths if path not in sys.path]


def websocket_url(value):
    value = value.strip()
    if any(ord(char) < 33 for char in value):
        raise ValueError("Enter only the HTTPS base address, without spaces")
    url = urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username is not None
            or url.password is not None or url.query or url.fragment
            or url.path not in ("", "/")):
        raise ValueError("Use https://your-host[:port] without credentials or a dashboard path")
    if url.port == 0:
        raise ValueError("Invalid port")
    return urlunsplit(("wss", url.netloc, "/api/websocket", "", ""))


async def probe(url):
    import aiohttp
    result = {"schema": "carrot-camera-network-preflight-v1", "passed": False,
              "credentials_sent": False, "camera_started": False,
              "scope": "TLS and HA WebSocket greeting only; no media or sustained throughput test"}
    try:
        async with asyncio.timeout(15):
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as session:
                # Certificate verification is enabled. No authentication is sent.
                async with session.ws_connect(url, max_msg_size=16384) as ws:
                    message = await ws.receive(timeout=5)
                    if message.type != aiohttp.WSMsgType.TEXT:
                        result["error"] = "no_text_greeting"
                    else:
                        try:
                            greeting = json.loads(message.data)
                        except (TypeError, ValueError):
                            greeting = None
                        result["passed"] = isinstance(greeting, dict) and greeting.get("type") == "auth_required"
                        if result["passed"]:
                            result["ha_auth_required_received"] = True
                        else:
                            result["error"] = "unexpected_greeting"
    except (aiohttp.ClientConnectorCertificateError, aiohttp.ClientSSLError):
        result["error"] = "tls_certificate_error"
    except aiohttp.WSServerHandshakeError as exc:
        result.update(error="websocket_upgrade_failed", http_status=exc.status)
    except TimeoutError:
        result["error"] = "connection_or_greeting_timeout"
    except (aiohttp.ClientError, OSError) as exc:
        result.update(error="connection_failed", error_type=type(exc).__name__)
    # Do not print exception messages/response bodies: they may contain the host.
    return result


def main():
    configure_comma_imports()
    try:
        value = input("HA external HTTPS base URL (no token): ")
        url = websocket_url(value)
    except (ValueError, EOFError):
        print('Invalid URL. Enter https://your-host[:port] only; no token or dashboard path.')
        return 1
    try:
        result = asyncio.run(probe(url))
    except ImportError as exc:
        print(json.dumps({"schema": "carrot-camera-network-preflight-v1", "passed": False,
                          "error": "dependency_import_failed", "module": exc.name,
                          "camera_started": False, "credentials_sent": False,
                          "hint": "Bundled pydeps checked. Report this result; do not install packages yet."}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
