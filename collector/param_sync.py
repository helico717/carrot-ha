"""CarrotPilot parameter synchronizer.

- Syncs settings catalog and current values from Carrot server (port 7000) to Cloudflare Worker.
- Polls Cloudflare Worker for pending parameter changes requested by Home Assistant.
- Applies requested parameter changes locally via http://127.0.0.1:7000/api/param_set (or Params()).
- Acknowledges applied parameter changes back to Cloudflare Worker.
"""
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
LOCAL_SERVER_URL = "http://127.0.0.1:7000"

logger = logging.getLogger("carrot_param_sync")


def _http_request(url: str, data: dict | None = None, headers: dict | None = None, timeout: float = 10.0) -> dict | None:
    req_headers = {"User-Agent": "CarrotHA-ParamSync/1.0.0", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return None


def fetch_local_settings_snapshot() -> dict | None:
    """Fetch catalog and current values from local carrot server."""
    res = _http_request(f"{LOCAL_SERVER_URL}/api/settings/snapshot", timeout=8.0)
    if res and res.get("ok"):
        return res
    return None


def apply_local_param(name: str, value: any) -> bool:
    """Apply parameter change via local carrot server or fallback to Params()."""
    # 1. Try local carrot_server API (preserves validation, clamping, and change history)
    res = _http_request(
        f"{LOCAL_SERVER_URL}/api/param_set",
        data={"name": name, "value": value, "source": "ha"},
        timeout=5.0
    )
    if res and res.get("ok"):
        return True

    # 2. Fallback to openpilot Params() if local server is down or unreachable
    try:
        from openpilot.common.params import Params
        params = Params()
        val_str = str(value)
        if isinstance(value, bool):
            params.put_bool(name, value)
        elif isinstance(value, int) and (val_str == "0" or val_str == "1"):
            params.put_bool(name, value == 1)
        else:
            params.put(name, val_str)
        return True
    except Exception as exc:
        print(f"[param_sync] fallback Params().put error: {exc}", flush=True)
        return False


def run_param_sync(config: dict):
    """Main loop for parameter synchronization."""
    cloud_url = config.get("url", "").rstrip("/")
    token = config.get("token", "")
    device_id = config.get("device", "")

    if not cloud_url or not token or not device_id:
        print("[param_sync] missing connection config; aborting sync", flush=True)
        return

    headers = {"Authorization": f"Bearer {token}"}
    last_catalog_sync = 0.0
    CATALOG_SYNC_INTERVAL = 180.0  # Sync full catalog every 3 minutes or at boot

    print("[param_sync] starting CarrotPilot parameter sync loop", flush=True)

    while True:
        now = time.time()

        # 1. Periodic full settings snapshot upload
        if now - last_catalog_sync >= CATALOG_SYNC_INTERVAL:
            snapshot = fetch_local_settings_snapshot()
            if snapshot and snapshot.get("settings") and snapshot.get("values"):
                sync_payload = {
                    "device_id": device_id,
                    "catalog": snapshot["settings"],
                    "values": snapshot["values"],
                }
                res = _http_request(
                    f"{cloud_url}/api/settings/sync",
                    data=sync_payload,
                    headers=headers,
                    timeout=15.0
                )
                if res and res.get("ok"):
                    last_catalog_sync = now
                    # print(f"[param_sync] settings snapshot synced to cloud ({now})", flush=True)

        # 2. Poll for pending parameter changes from Home Assistant
        pending_res = _http_request(
            f"{cloud_url}/api/params/pending?device_id={urllib.parse.quote(device_id)}",
            headers=headers,
            timeout=10.0
        )

        if pending_res and pending_res.get("ok"):
            pending_list = pending_res.get("pending", [])
            if pending_list:
                applied_ids = []
                current_values = {}

                for item in pending_list:
                    item_id = item.get("id")
                    param_name = item.get("param_name")
                    raw_val = item.get("param_value")

                    # Parse value type if possible (int, float, bool, or str)
                    parsed_val = raw_val
                    if isinstance(raw_val, str):
                        if raw_val.lower() == "true":
                            parsed_val = 1
                        elif raw_val.lower() == "false":
                            parsed_val = 0
                        else:
                            try:
                                if "." in raw_val:
                                    parsed_val = float(raw_val)
                                else:
                                    parsed_val = int(raw_val)
                            except ValueError:
                                parsed_val = raw_val

                    success = apply_local_param(param_name, parsed_val)
                    if success:
                        applied_ids.append(item_id)
                        current_values[param_name] = parsed_val
                        print(f"[param_sync] applied param {param_name} = {parsed_val}", flush=True)

                if applied_ids:
                    ack_payload = {
                        "device_id": device_id,
                        "applied_ids": applied_ids,
                        "current_values": current_values
                    }
                    _http_request(
                        f"{cloud_url}/api/params/ack",
                        data=ack_payload,
                        headers=headers,
                        timeout=10.0
                    )

        # Poll interval: 3 seconds
        time.sleep(3)


def start_param_sync_thread(config: dict) -> threading.Thread:
    thread = threading.Thread(target=run_param_sync, args=(config,), daemon=True, name="CarrotParamSync")
    thread.start()
    return thread


if __name__ == "__main__":
    conn_file = BASE / "connection.json"
    if conn_file.exists():
        conf = json.loads(conn_file.read_text())
        run_param_sync(conf)
    else:
        print("connection.json not found")
