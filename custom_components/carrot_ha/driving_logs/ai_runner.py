"""Isolated full-cereal log extraction. No network, GPS, video or device writes."""
import bz2
import json
import math
import os
from pathlib import Path
import sys


def read_log(path):
    limit = 256 * 1024**2
    if path.name.endswith('.bz2'):
        stream = bz2.open(path, 'rb')
    elif path.name.endswith('.zst'):
        from radar_runner import install_stdlib_zstd
        install_stdlib_zstd()
        import zstandard
        source = path.open('rb')
        try:
            stream = zstandard.ZstdDecompressor().stream_reader(source)
        except BaseException:
            source.close()
            raise
    else:
        stream = path.open('rb')
    try:
        data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('decompressed_log_limit')
        return data
    finally:
        stream.close()
        if path.name.endswith('.zst'):
            source.close()


def value(obj, field, scale=1):
    try:
        v = float(getattr(obj, field)) * scale
        return round(v, 3) if math.isfinite(v) else None
    except (AttributeError, TypeError, ValueError):
        return None


def extract(schema, path):
    frames, state, stamps, metadata = [], {}, {}, {}
    start, last = None, -1
    for event in schema.Event.read_multiple_bytes(read_log(path), traversal_limit_in_words=8*1024*1024):
        kind, stamp = event.which(), event.logMonoTime * 1e-9
        if kind == 'carParams':
            cp = event.carParams
            metadata['car'] = str(cp.carFingerprint)[:120]
            metadata['steer_control'] = str(cp.steerControlType)[:24]
            metadata['openpilot_longitudinal'] = bool(cp.openpilotLongitudinalControl)
        if kind not in {'carState','carControl','longitudinalPlan','radarState','selfdriveState','carrotMan'}:
            continue
        if not event.valid:
            state.pop(kind, None)
            continue
        if kind == 'carState':
            cs = event.carState
            state[kind] = {'speed_kph':value(cs,'vEgo',3.6), 'accel':value(cs,'aEgo'),
                'angle':value(cs,'steeringAngleDeg'), 'gas':bool(cs.gasPressed),
                'brake':bool(cs.brakePressed),'steer':bool(cs.steeringPressed),'standstill':bool(cs.standstill)}
        elif kind == 'carControl':
            actuators = event.carControl.actuators
            state[kind] = {'command_accel':value(actuators,'accel')}
            if metadata.get('steer_control') == 'angle':
                state[kind]['desired_angle'] = value(actuators,'steeringAngleDeg')
        elif kind == 'longitudinalPlan':
            lp = event.longitudinalPlan
            state[kind] = {'target_accel':value(lp,'aTarget')}
            if state[kind]['target_accel'] is None and len(lp.accels):
                state[kind]['target_accel'] = float(lp.accels[0])
        elif kind == 'radarState':
            lead = event.radarState.leadOne
            state[kind] = {'lead_distance':value(lead,'dRel') if lead.status else None,
                           'lead_speed_kph':value(lead,'vLead',3.6) if lead.status else None}
        elif kind == 'selfdriveState':
            state[kind] = {'enabled':bool(event.selfdriveState.enabled)}
        elif kind == 'carrotMan':
            cm = event.carrotMan
            state[kind] = {'desired_speed':value(cm,'desiredSpeed'), 'speed_source':str(getattr(cm,'desiredSource',''))[:20]}
        stamps[kind] = stamp
        if kind != 'carState':
            continue
        if start is None:
            start = stamp
        if stamp - last < 0.24:
            continue
        last = stamp
        frame = {'sec':round(stamp-start, 3)}
        for service, fields in state.items():
            if 0 <= stamp-stamps[service] <= 1.0:
                frame.update(fields)
        frames.append(frame)
        if len(frames) > 3000:
            raise ValueError('segment_duration_limit')
    return frames, metadata


if __name__ == '__main__':
    try:
        if os.name == 'posix':
            import resource
            os.nice(10)
            resource.setrlimit(resource.RLIMIT_AS, (1536*1024**2,1536*1024**2))
        engine, request_file, output = sys.argv[1:]
        sys.path.insert(0, engine)
        from openpilot.selfdrive.carrot.radar.tools.radar_validation_replay import _route_replay_module
        from ai_summary import summarize
        schema = _route_replay_module().load_openpilot_log_schema()
        request = json.loads(Path(request_file).read_text())
        result = []
        for item in request['sources']:
            frames, metadata = extract(schema, Path(item['path']))
            result.append({**summarize(frames,item['alias'],request['overrides']), 'metadata':metadata})
        Path(output).write_text(json.dumps(result, allow_nan=False, separators=(',',':')))
    except Exception as error:
        # Never expose raw recording data, filenames, locations or credentials.
        print(type(error).__name__,file=sys.stderr)
        raise SystemExit(1)
