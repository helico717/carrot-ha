"""Free local tuning review. No network, parameter writes or invented causes.

Categories follow ajouatom/openpilot hoya/c3-atune AutoTuner (0e9c589c),
with actual-catalog, active-control and evidence gates instead of fixed defaults.
"""
import math

POLICY_VERSION = 1


def assess(summaries, definitions, segments):
    evidence, counts, findings, recommendations = [], {}, [], []
    for index, summary in enumerate(summaries):
        for kind, count in summary.get('event_counts', {}).items():
            counts[kind] = counts.get(kind, 0) + count
        for event in summary.get('events', []):
            evidence.append({**event, 'id':f'E{len(evidence)+1}', 'segment':segments[index]})
    by_kind = {}
    for event in evidence:
        by_kind.setdefault(event['kind'], []).append(event)

    def observation(kind, title, detail):
        events = by_kind.get(kind, [])
        if not events:return []
        ids = [event['id'] for event in events[:6]]
        findings.append({'title':title, 'detail':detail, 'evidence_ids':ids})
        return events

    def candidate(name, direction, refs, reason, tradeoff, floor=None):
        definition = definitions.get(name)
        if not definition or not refs:return
        current = definition['current']
        # One small review step, never a forced upstream constant or fabricated default.
        change = max(1 if definition['integer'] else 0.01, abs(current)*0.10)
        target = current + direction*change
        if floor is not None:target = max(floor, target)
        target = max(definition['min'], min(definition['max'], target))
        target = int(round(target)) if definition['integer'] else round(target, 3)
        if not math.isfinite(target) or target==current:return
        recommendations.append({'name':name, 'title':definition['title'], 'current':current,
            'recommended':target, 'reason':reason, 'tradeoff':tradeoff,
            'evidence_ids':[event['id'] for event in refs[:6]]})

    acceleration = observation('acceleration','목표 가속도 상승 관측',
        '활성 제어 중 가속페달 개입 없이 목표 가속도가 커진 구간입니다. 정상적인 출발·추종일 수도 있으므로 승차감 문제로 확정하지 않습니다.')
    low_speed = [event for event in acceleration if
        0 <= event['measurements'].get('speed_kph', 999) <= 30 and
        event['measurements'].get('target_accel', 0) > 1.6]
    if len(low_speed)>=2:
        candidate('CruiseMaxVals1',-1,low_speed,
            '저속 목표 가속 상승이 서로 떨어진 시점에서 반복되었습니다. 현재 카탈로그의 저속 가속 상한을 약10% 낮추는 비교 후보입니다.',
            '출발과 앞차 추종 반응이 느려질 수 있습니다. 다른 설정과 동시에 변경하지 말고 같은 조건에서 비교하세요.',floor=0)

    deceleration = observation('deceleration','강한 감속 관측',
        '브레이크 개입 없이 강한 감속 또는 감속 목표가 기록됐습니다. 앞차·도로 상황을 영상과 함께 확인해야 합니다.')
    stopping = [event for event in deceleration if
        0 <= event['measurements'].get('speed_kph', 999) <= 8 and
        event['measurements'].get('accel', 0) < -2.2]
    if len(stopping)>=2 and definitions.get('StoppingAccel',{}).get('current',0)<0:
        candidate('StoppingAccel',1,stopping,
            '낮은 속도에서 강한 감속이 반복되어 정차 감속 설정을 약10% 완화하는 비교 후보를 제시합니다. 정차 원인이 이 값이라고 확정한 것은 아닙니다.',
            '감속·정지 위치가 달라질 수 있습니다. 실제 정차 거리와 제동 동작을 확인하며 수동으로 검토하세요.')

    observation('departure','정차 후 출발 구간',
        '정차에서 이동으로 전환된 상대 시각입니다. 앞차가 움직인 시점과 비교하지 않고 출발 지연을 단정하지 않습니다.')
    steering = observation('steering','목표·실제 조향각 차이 관측',
        '활성 제어 중 목표와 실제 핸들 각도의 차이가 관측됐습니다. 이 차이만으로 조향비·지연·토크 설정을 변경하지 않습니다.')
    limitations = ['규칙 기반 무료 분석이며 외부 AI 호출·파라미터 자동 변경은 없습니다.',
        '현재 카탈로그·값 범위와 실제 로그 근거를 확인한 후보만 제시합니다. 추천이 없으면 현재 값을 유지하세요.',
        '현재값은 분석 시점이며 주행 당시 설정과 다를 수 있습니다. 도로 형상·운전자 의도·설정 효과는 확정하지 않습니다.',
        '저장된 모든 대상 세그먼트를 읽지만 신호는 약0.25초 간격으로 관찰합니다. 짧은 사건이 누락될 수 있습니다.']
    if not definitions:limitations.append('현재 차량 파라미터 카탈로그를 받지 못해 변경 후보를 생성하지 않았습니다.')
    if steering:limitations.append('조향각 차이의 원인을 확인할 정보가 부족하므로 조향 파라미터 변경을 제안하지 않습니다.')
    known=sum(s.get('control_state_known_frames',0) for s in summaries)
    frames=sum(s.get('frames',0) for s in summaries)
    if known<frames:limitations.append(f'활성 제어 여부를 확인한 표본은 {known}/{frames}개입니다. 미확인 표본으로 변경 후보를 만들지 않습니다.')
    maximum=lambda key: max((s[key] for s in summaries if s.get(key) is not None),default=None)
    minimum=lambda key: min((s[key] for s in summaries if s.get(key) is not None),default=None)
    return {'engine':'local-rules','policy_version':POLICY_VERSION,'model':'무료 로컬 규칙 분석',
        'summary':f'저장된 {len(segments)}개 구간을 순서대로 분석했습니다. 현재 카탈로그와 근거를 만족하는 변경 검토 후보는 {len(recommendations)}개입니다.',
        'findings':findings,'recommendedParams':recommendations,'evidence':evidence,
        'scope':[{'segment':name,'frames':s['frames'],'duration_sec':s['duration_sec']} for name,s in zip(segments,summaries)],
        'limitations':limitations,'stats':{'segments':len(segments),'frames':frames,
            'duration_sec':round(sum(s.get('duration_sec',0) for s in summaries),2),
            'max_speed_kph':maximum('max_speed_kph'),'max_accel':maximum('max_accel'),
            'min_accel':minimum('min_accel'),'event_counts':counts},'external_requests':0}
