"""Camera relay primitives used by the HA transport adapter and comma agent.

All methods run on one asyncio event loop. The transport adapter must call tick
regularly, deliver commands to the device, and close failed readers. No camera
or network connection is started by importing this module.
"""
import asyncio
from dataclasses import dataclass, field
import struct
import time
import uuid

CAMERAS = {"wide": 1, "driver": 2}
HEADER = struct.Struct("!4s16sB")
MAGIC = b"CHV1"
MAX_PAYLOAD = 188 * 512
MAX_VIEWERS = 8
QUEUE_CHUNKS = 16
LEASE_SECONDS = 12
MAX_SESSION_SECONDS = 300


def encode_media(session_id, camera, payload):
    if camera not in CAMERAS:
        raise ValueError("Unknown camera")
    _validate_ts(payload)
    return HEADER.pack(MAGIC, uuid.UUID(session_id).bytes, CAMERAS[camera]) + payload


def _validate_ts(payload):
    if not payload or len(payload) > MAX_PAYLOAD or len(payload) % 188:
        raise ValueError("Invalid MPEG-TS payload size")
    if any(payload[offset] != 0x47 for offset in range(0, len(payload), 188)):
        raise ValueError("Invalid MPEG-TS packet sync")


def decode_media(data):
    if not isinstance(data, bytes) or len(data) < HEADER.size or len(data) > HEADER.size + MAX_PAYLOAD:
        raise ValueError("Invalid media message size")
    magic, session, camera_id = HEADER.unpack_from(data)
    if magic != MAGIC or camera_id not in CAMERAS.values():
        raise ValueError("Invalid media message header")
    payload = data[HEADER.size:]
    _validate_ts(payload)
    camera = next(name for name, value in CAMERAS.items() if value == camera_id)
    return str(uuid.UUID(bytes=session)), camera, payload


@dataclass(eq=False)
class Reader:
    camera: str
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=QUEUE_CHUNKS))
    closed: bool = False
    reason: str | None = None

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

    def subscribe(self, camera):
        if camera not in CAMERAS:
            raise ValueError("Unknown camera")
        if (not self.ready or self.generation is None or self.last_device_seen is None
                or self.clock() - self.last_device_seen >= LEASE_SECONDS):
            raise RuntimeError("Device not ready")
        if len(self.readers) >= MAX_VIEWERS:
            raise RuntimeError("Viewer limit reached")
        commands = []
        if self.session_id is None:
            self.session_id = str(uuid.uuid4())
            self.started = self.clock()
            commands.append({"type": "start", "session_id": self.session_id,
                             "cameras": list(CAMERAS), "lease_seconds": LEASE_SECONDS,
                             "max_seconds": MAX_SESSION_SECONDS})
        elif self.clock() - self.started >= MAX_SESSION_SECONDS:
            # The adapter's periodic tick is responsible for teardown; never
            # extend the existing deadline when another viewer arrives.
            raise RuntimeError("Session expired")
        reader = Reader(camera)
        self.readers.add(reader)
        return reader, commands

    def unsubscribe(self, reader):
        if reader not in self.readers:
            return []
        self.readers.remove(reader)
        reader.close("viewer_closed")
        return self.stop("no_viewers") if not self.readers else []

    def accept_media(self, generation, data):
        if generation != self.generation or generation is None:
            return []
        if self.clock() - self.last_device_seen >= LEASE_SECONDS:
            return self.disconnect(generation)
        session_id, camera, payload = decode_media(data)
        if session_id != self.session_id or self.session_id is None:
            return []
        if self.clock() - self.started >= MAX_SESSION_SECONDS:
            return self.stop("session_expired")
        # Media traffic is not an offroad status heartbeat. Never extend a
        # device lease using an endless video stream alone.
        for reader in tuple(self.readers):
            if reader.camera != camera:
                continue
            try:
                reader.queue.put_nowait(payload)
            except asyncio.QueueFull:
                self.readers.remove(reader)
                reader.close("slow_consumer")
        return self.stop("no_viewers") if not self.readers else []

    def tick(self):
        if self.generation is not None and self.clock() - self.last_device_seen >= LEASE_SECONDS:
            return self.disconnect(self.generation)
        if self.session_id is None:
            return []
        if self.clock() - self.started >= MAX_SESSION_SECONDS:
            return self.stop("session_expired")
        return [{"type": "renew", "session_id": self.session_id,
                 "lease_seconds": LEASE_SECONDS}]

    def stop(self, reason):
        session_id = self.session_id
        self.session_id, self.started, self.last_reason = None, None, reason
        for reader in self.readers:
            reader.close(reason)
        self.readers.clear()
        return [{"type": "stop", "session_id": session_id, "reason": reason}] if session_id else []
