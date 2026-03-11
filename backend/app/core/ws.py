from fastapi import WebSocket

ws_clients: set[WebSocket] = set()


async def notify_ws(message: dict):
    """Broadcast a message to all connected WebSocket clients."""
    for ws in list(ws_clients):
        try:
            await ws.send_json(message)
        except Exception:
            ws_clients.discard(ws)
