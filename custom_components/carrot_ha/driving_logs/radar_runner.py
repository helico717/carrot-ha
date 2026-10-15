"""Isolated entry point: original Git engine, no HA imports or vehicle writes."""
import json
import os
from pathlib import Path
import sys
import traceback


def native_zstd_reader(source):
    """Bounded libzstd fallback for HA Python builds without the optional _zstd."""
    import ctypes as c
    import ctypes.util
    import io
    library = ctypes.util.find_library('zstd') or 'libzstd.so.1'
    lib = c.CDLL(library)

    class Buffer(c.Structure):
        _fields_ = [('data', c.c_void_p), ('size', c.c_size_t), ('pos', c.c_size_t)]

    lib.ZSTD_createDStream.restype = c.c_void_p
    lib.ZSTD_freeDStream.argtypes = [c.c_void_p]
    lib.ZSTD_initDStream.argtypes = [c.c_void_p]
    lib.ZSTD_initDStream.restype = c.c_size_t
    lib.ZSTD_decompressStream.argtypes = [c.c_void_p, c.POINTER(Buffer), c.POINTER(Buffer)]
    lib.ZSTD_decompressStream.restype = c.c_size_t
    lib.ZSTD_isError.argtypes = [c.c_size_t]
    lib.ZSTD_isError.restype = c.c_uint
    stream = lib.ZSTD_createDStream()
    if not stream:
        raise MemoryError('Zstandard stream allocation failed')
    result = io.BytesIO()
    output_data = c.create_string_buffer(131072)
    try:
        if lib.ZSTD_isError(lib.ZSTD_initDStream(stream)):
            raise ValueError('Zstandard initialization failed')
        remaining = 0
        while chunk := source.read(131072):
            input_data = c.create_string_buffer(chunk)
            incoming = Buffer(c.cast(input_data, c.c_void_p), len(chunk), 0)
            while True:
                outgoing = Buffer(c.cast(output_data, c.c_void_p), len(output_data), 0)
                previous = incoming.pos
                remaining = lib.ZSTD_decompressStream(stream, c.byref(outgoing), c.byref(incoming))
                if lib.ZSTD_isError(remaining):
                    raise ValueError('Invalid Zstandard frame')
                if result.tell() + outgoing.pos > 512 * 1024**2:
                    raise ValueError('Decompressed log exceeds limit')
                result.write(output_data.raw[:outgoing.pos])
                if incoming.pos == incoming.size and (remaining == 0 or outgoing.pos < len(output_data)):
                    break
                if incoming.pos == previous and outgoing.pos == 0:
                    raise ValueError('Zstandard stream made no progress')
        if remaining:
            raise ValueError('Truncated Zstandard frame')
        result.seek(0)
        return result
    except BaseException:
        result.close()
        raise
    finally:
        lib.ZSTD_freeDStream(stream)


def install_stdlib_zstd(force_native=False):
    """Adapt the original engine's streaming API to HA's Python 3.14 stdlib."""
    if sys.version_info < (3, 14):
        return
    from types import ModuleType
    try:
        if force_native:
            raise ImportError('Native fallback test')
        from compression import zstd
        reader = lambda source: zstd.ZstdFile(source, 'rb')
    except ImportError:
        reader = native_zstd_reader

    class ZstdDecompressor:
        def stream_reader(self, source):
            return reader(source)

    adapter = ModuleType('zstandard')
    adapter.ZstdDecompressor = ZstdDecompressor
    sys.modules['zstandard'] = adapter

if __name__ == '__main__':
    try:
        if os.name == 'posix':
            import resource
            os.nice(10)
            resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024**2, 1536 * 1024**2))
        engine, source, output, sensor, flip = sys.argv[1:]
        sys.path.insert(0, engine)
        install_stdlib_zstd()
        from openpilot.selfdrive.carrot.radar.tools.radar_web_export import export_frames
        from openpilot.selfdrive.carrot.radar.tools.radar_validation_replay import load_frames
        frames = load_frames(Path(source), radar_track_flip={'recorded':None,'normal':False,'flipped':True}[flip])
        result = export_frames(frames, sensor=sensor, sensitivity=3)
        result.update(radarTrackFlip=flip, sourceLog=Path(source).name)
        Path(output).write_text(json.dumps(result, separators=(',', ':'), allow_nan=False))
    except Exception as error:
        print(json.dumps({'error_type':type(error).__name__, 'frames':[
            f'{Path(frame.filename).name}:{frame.lineno}:{frame.name}' for frame in traceback.extract_tb(error.__traceback__)]}), file=sys.stderr)
        raise SystemExit(1)
