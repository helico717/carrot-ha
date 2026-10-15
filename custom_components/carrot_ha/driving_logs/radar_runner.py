"""Isolated entry point: original Git engine, no HA imports or vehicle writes."""
import json
import os
from pathlib import Path
import sys
import traceback

if __name__ == '__main__':
    try:
        if os.name == 'posix':
            import resource
            os.nice(10)
            resource.setrlimit(resource.RLIMIT_AS, (1536 * 1024**2, 1536 * 1024**2))
        engine, source, output, sensor, flip = sys.argv[1:]
        sys.path.insert(0, engine)
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
