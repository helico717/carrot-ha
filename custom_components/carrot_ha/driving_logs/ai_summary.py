"""Bounded, location-free observations from already decoded driving records."""
import math


def number(value):
    return float(value) if type(value) in (int, float) and math.isfinite(value) else None


def summarize(frames, alias, include_overrides=False):
    """Describe observations, never infer the driver's intent or a tuning cause."""
    if not frames:
        raise ValueError('no_vehicle_frames')
    events, previous, last_event = [], None, {}
    speeds, accelerations, targets = [], [], []
    overrides = {'gas': 0, 'brake': 0, 'steer': 0}
    for frame in frames:
        t = frame['sec']
        for key, values in [('speed_kph', speeds), ('accel', accelerations), ('target_accel', targets)]:
            if (v := number(frame.get(key))) is not None:
                values.append(v)
        for key in overrides:
            if frame.get(key) is True and previous and previous.get(key) is False:
                overrides[key] += 1
        active = frame.get('enabled') is True
        candidates = []
        if active and not frame.get('gas') and (number(frame.get('target_accel')) or 0) >= 1.4:
            candidates.append(('acceleration', '목표 가속도 상승'))
        if active and not frame.get('brake') and ((number(frame.get('accel')) or 0) <= -2.0 or (number(frame.get('target_accel')) or 0) <= -1.8):
            candidates.append(('deceleration', '강한 감속 관측'))
        desired, actual = number(frame.get('desired_angle')), number(frame.get('angle'))
        if active and (number(frame.get('speed_kph')) or 0) >= 30 and not frame.get('steer') and desired is not None and actual is not None and abs(desired - actual) >= 3:
            candidates.append(('steering', '목표·실제 조향각 차이'))
        if previous and active and previous.get('standstill') is True and frame.get('standstill') is False:
            candidates.append(('departure', '정차 후 출발'))
        if include_overrides and previous:
            for key in overrides:
                if frame.get(key) is True and previous.get(key) is False:
                    candidates.append(('override', {'gas':'가속페달','brake':'브레이크','steer':'핸들'}[key] + ' 수동 개입 · 의도 미확인'))
        for kind, title in candidates:
            if t - last_event.get(kind, -100) < 5:
                continue
            last_event[kind] = t
            events.append({'kind': kind, 'title': title, 'alias': alias, 'sec': round(t, 2),
                           'measurements': {k: frame[k] for k in ('speed_kph','accel','target_accel','command_accel','lead_distance','lead_speed_kph','angle','desired_angle','desired_speed','speed_source') if frame.get(k) is not None}})
        previous = frame
    event_counts={kind:sum(event['kind']==kind for event in events) for kind in {event['kind'] for event in events}}
    # Evenly sample the whole selection, rather than silently dropping late events.
    if len(events) > 16:
        events = [events[round(i * (len(events)-1)/15)] for i in range(16)]
    points = frames if len(frames) <= 32 else [frames[round(i * (len(frames)-1)/31)] for i in range(32)]
    if not events:
        mid=frames[len(frames)//2]
        events=[{'kind':'sample','title':'주행 상태 표본 · 사건 임계값 미충족','alias':alias,'sec':mid['sec'],
                 'measurements':{k:mid[k] for k in ('speed_kph','accel','target_accel') if mid.get(k) is not None}}]
    if not include_overrides:
        points=[{k:v for k,v in f.items() if k not in overrides} for f in points]
    return {'alias': alias, 'duration_sec': round(frames[-1]['sec'], 2), 'frames': len(frames),
            'max_speed_kph': max(speeds, default=None), 'max_accel': max(accelerations, default=None),
            'min_accel': min(accelerations, default=None), 'max_target_accel': max(targets, default=None),
            'control_state_known_frames': sum(type(f.get('enabled')) is bool for f in frames),
            'overrides': overrides if include_overrides else None,
            'events': events, 'event_counts':event_counts, 'sample': points}
