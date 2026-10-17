import asyncio
import json
from typing import Any, AsyncGenerator, Dict, Set


class EventBus:
    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        """
        Subscribes a new SSE listener queue.
        """
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """
        Removes an inactive listener queue.
        """
        self._subscribers.discard(q)

    def publish(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Broadcasts an event to all connected SSE clients.
        Non-blocking: drops message for slow/overflowing queues.
        """
        payload = {"event": event_type, "data": data}
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except (asyncio.QueueFull, Exception):
                pass

    async def sse_generator(self) -> AsyncGenerator[str, None]:
        """
        Yields standard SSE formatted chunks:
        event: <type>
        data: <json>

        """
        q = self.subscribe()
        try:
            # Yield initial connection heartbeat
            initial_msg = {"status": "connected", "subscribers": len(self._subscribers)}
            yield f"event: ping\ndata: {json.dumps(initial_msg)}\n\n"

            while True:
                item = await q.get()
                event_name = item.get("event", "message")
                data_str = json.dumps(item.get("data", {}))
                yield f"event: {event_name}\ndata: {data_str}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self.unsubscribe(q)


event_bus = EventBus()
