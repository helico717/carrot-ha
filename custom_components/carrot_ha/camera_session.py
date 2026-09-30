"""Camera relay primitives used by the HA transport adapter and comma agent.

All methods run on one asyncio event loop. The transport adapter must call tick
regularly, deliver commands to the device, and close failed readers. No camera
or network connection is started by importing this module.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import struct
import time
import uuid

CAMERAS = {"wide": 1, "driver": 2, "road": 3}
MAGIC_WLV1 = b"WLV1"
HEADER_SIZE = 24
HEADER = struct.Struct("!4sBB6sQI")

FRAME_METADATA = 0
FRAME_WIDE = 1
FRAME_DRIVER = 2
FRAME_STATUS = 3
FRAME_ROAD = 4

CAMERAS_BY_ID = {
    FRAME_WIDE: "wide",
    FRAME_DRIVER: "driver",
    FRAME_ROAD: "road",
}
ID_BY_CAMERAS = {v: k for k, v in CAMERAS_BY_ID.items()}

FLAG_KEY = 0x01
MAX_PAYLOAD = 4 * 1024 * 1024
MAX_VIEWERS = 8
QUEUE_CHUNKS = 32
LEASE_SECONDS = 12
MAX_SESSION_SECONDS = 300


def decode_frame_header(data):
    if not isinstance(data, (bytes, bytearray)) or len(data) < HEADER_SIZE:
        raise ValueError("Frame too short")
    magic, frame_type, flags, _, timestamp_us, payload_size = HEADER.unpack_from(data)
    if magic != MAGIC_WLV1:
        raise ValueError(f"Invalid frame magic: {magic!r}")
    if len(data) < HEADER_SIZE + payload_size:
        raise ValueError("Incomplete frame payload")
    is_key = bool(flags & FLAG_KEY)
    camera = CAMERAS_BY_ID.get(frame_type)
    return frame_type, camera, is_key, timestamp_us, payload_size


@dataclass(eq=False)
class Reader:
    camera: str  # "wide", "driver", "all"
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=QUEUE_CHUNKS))
    closed: bool = False
    reason: str | None = None
    dropping_until_key: bool = False

    def close(self, reason):
        if self.closed:
            return
        self.closed, self.reason = True, reason
        while not self.queue.empty():
            self.queue.get_nowait()
        self.queue.put_nowait(None)



class CameraSession:
    """One device upstream shared by independent wide/driver readers.

    Commands are returned to the caller, never sent through a user-provided
    callback while state is half updated. Device generation IDs prevent a late
    old socket disconnect or packet from touching a replacement connection.
    """

    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.generation = None
        self.ready = False
        self.session_id = None
        self.started = None
        self.deadline = None
        self.last_device_seen = None
        self.readers = set()
        self.last_reason = None

    def connect(self):
        if self.generation is not None:
            raise RuntimeError("Device already connected")
        self.generation = str(uuid.uuid4())
        self.ready = False
        self.last_device_seen = self.clock()
        return self.generation

    def device_status(self, generation, *, offroad):
        if generation != self.generation or generation is None:
            return []
        self.last_device_seen = self.clock()
        self.ready = offroad is True
        if not self.ready:
            return self.stop("device_not_offroad")
        return []

    def disconnect(self, generation):
        if generation != self.generation or generation is None:
            return []
        commands = self.stop("device_disconnected")
        self.generation, self.ready, self.last_device_seen = None, False, None
        return commands

    def subscribe(self, camera, *, deadline=None):
        if camera not in CAMERAS and camera != "all":
            raise ValueError("Unknown camera")
        if (not self.ready or self.generation is None or self.last_device_seen is None
                or self.clock() - self.last_device_seen >= LEASE_SECONDS):
            raise RuntimeError("Device not ready")
        if len(self.readers) >= MAX_VIEWERS:
            raise RuntimeError("Viewer limit reached")
        commands = []
        if deadline is not None and self.clock() >= deadline:
            raise RuntimeError("Viewing request expired")
        if self.session_id is None:
            self.session_id = str(uuid.uuid4())
            self.started = self.clock()
            self.deadline = min(self.started + MAX_SESSION_SECONDS,
                                deadline if deadline is not None else float('inf'))
            commands.append({"type": "start", "session_id": self.session_id,
                             "cameras": list(CAMERAS), "lease_seconds": LEASE_SECONDS,
                             "max_seconds": MAX_SESSION_SECONDS, "protocol": 2})
        elif self.clock() >= self.deadline:
            # The adapter's periodic tick is responsible for teardown; never
            # extend the existing deadline when another viewer arrives.
            raise RuntimeError("Session expired")
        elif deadline is not None:
            self.deadline = min(self.deadline, deadline)
        reader = Reader(camera)
        self.readers.add(reader)
        return reader, commands

    def unsubscribe(self, reader, *, reason="no_viewers"):
        if reader not in self.readers:
            return []
        self.readers.remove(reader)
        reader.close("viewer_closed")
        return self.stop(reason) if not self.readers else []

    def accept_media(self, generation, data):
        if generation != self.generation or generation is None:
            return []
        if self.clock() - self.last_device_seen >= LEASE_SECONDS:
            return self.disconnect(generation)
        if self.session_id is None:
            return []
        if self.clock() >= self.deadline:
            return self.stop("session_expired")

        try:
            frame_type, camera, is_key, _, _ = decode_frame_header(data)
        except ValueError:
            return []

        # Deliver full wire frame to matching readers
        for reader in tuple(self.readers):
            if reader.camera != "all" and reader.camera != camera:
                continue

            if reader.dropping_until_key:
                if not is_key:
                    continue
                reader.dropping_until_key = False

            try:
                reader.queue.put_nowait(data)
            except asyncio.QueueFull:
                if not is_key:
                    reader.dropping_until_key = True
                else:
                    while not reader.queue.empty():
                        try:
                            reader.queue.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                    try:
                        reader.queue.put_nowait(data)
                    except asyncio.QueueFull:
                        pass
        return self.stop("no_viewers") if not self.readers else []

    def tick(self):
        if self.generation is not None and self.clock() - self.last_device_seen >= LEASE_SECONDS:
            return self.disconnect(self.generation)
        if self.session_id is None:
            return []
        if self.clock() >= self.deadline:
            return self.stop("session_expired")
        return [{"type": "renew", "session_id": self.session_id,
                 "lease_seconds": LEASE_SECONDS}]

    def stop(self, reason):
        session_id = self.session_id
        self.session_id, self.started, self.deadline, self.last_reason = None, None, None, reason
        for reader in self.readers:
            reader.close(reason)
        self.readers.clear()
        return [{"type": "stop", "session_id": session_id, "reason": reason}] if session_id else []
