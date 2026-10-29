"""Existing project motion3 compatibility function, extracted without behavior changes.

This module only normalizes an in-memory copy. It does not contain Live2D SDK/Core,
rendering code, a native bridge, or a browser player.
"""
from __future__ import annotations
import copy
import hashlib
import json
import math
import re
from decimal import Decimal


def normalize_motion(data: bytes, *, group_targets: bool = True) -> tuple[bytes, dict]:
    original = json.loads(data)
    if original.get('Version') != 3:
        raise ValueError('Only motion3 JSON version 3 is supported')
    motion = copy.deepcopy(original)
    curves = motion['Curves']
    meta = motion['Meta']
    if not isinstance(curves, list) or not curves:
        raise ValueError('Motion has no curves')
    for key in ('Duration', 'Fps'):
        if not isinstance(meta.get(key), (int, float)) or not math.isfinite(meta[key]) or meta[key] <= 0:
            raise ValueError(f'Invalid motion {key}')
    targets = {'Model': 0, 'Parameter': 1, 'PartOpacity': 2}
    if any(curve.get('Target') not in targets for curve in curves):
        raise ValueError('Unsupported curve target')
    order = sorted(range(len(curves)), key=lambda i: targets[curves[i]['Target']]) if group_targets else list(range(len(curves)))
    curves = motion['Curves'] = [curves[i] for i in order]
    segments = points = 0
    for curve in curves:
        if not isinstance(curve.get('Id'), str) or not curve['Id']:
            raise ValueError('Missing curve ID')
        stream = curve['Segments']
        if not isinstance(stream, list) or len(stream) < 5:
            raise ValueError('Official parser requires a point and at least one segment')
        if any(not isinstance(x, (int, float)) or not math.isfinite(x) for x in stream):
            raise ValueError('Nonfinite or nonnumeric curve data')
        points += 1
        offset = 2
        previous_time = stream[0]
        while offset < len(stream):
            kind = stream[offset]
            if kind not in (0, 1, 2, 3):
                raise ValueError(f'Invalid segment type {kind}')
            width = 7 if kind == 1 else 3
            if offset + width > len(stream):
                raise ValueError('Truncated curve segment')
            endpoint = stream[offset + width - 2]
            if endpoint <= previous_time:
                raise ValueError('Segment endpoint time must increase')
            previous_time = endpoint
            segments += 1
            points += 3 if kind == 1 else 1
            offset += width
    updates = {'CurveCount': len(curves), 'TotalSegmentCount': segments, 'TotalPointCount': points}
    before = {k: meta.get(k) for k in updates}
    meta.update(updates)
    events = motion.get('UserData', [])
    if meta.get('UserDataCount', 0) != len(events):
        raise ValueError('UserData aggregate count mismatch; not automatically changed')
    if curves != [original['Curves'][i] for i in order] or motion.get('UserData') != original.get('UserData'):
        raise AssertionError('Motion curve/event content changed')
    # Official 5-r.5 numeric parser requires a newline/comma after numbers and
    # does not accept scientific notation. Formatting changes preserve numeric values.
    text = json.dumps(motion, ensure_ascii=False, indent=2, allow_nan=False)
    tokens = re.compile(r'"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?[eE][+-]?\d+)')
    text = tokens.sub(lambda m: format(Decimal(m.group(1)), 'f') if m.group(1) else m.group(0), text)
    normalized = text.encode('utf-8')
    roundtrip = json.loads(normalized)
    restored = copy.deepcopy(roundtrip)
    restored['Curves'] = [None] * len(order)
    for new_index, original_index in enumerate(order):
        restored['Curves'][original_index] = roundtrip['Curves'][new_index]
    for k in updates:
        if k in original['Meta']:
            restored['Meta'][k] = original['Meta'][k]
        else:
            del restored['Meta'][k]
    if restored != original:
        raise AssertionError('Unexpected mutation beyond aggregate counts and stable target grouping')
    return normalized, {
        'source_sha256': hashlib.sha256(data).hexdigest(),
        'normalized_sha256': hashlib.sha256(normalized).hexdigest(),
        'original_counts': before,
        'normalized_counts': updates,
        'counts_changed': before != updates,
        'curves_unchanged': True,
        'curve_order_changed': order != list(range(len(order))),
        'original_curve_indices_in_runtime_order': order,
        'duration': meta['Duration'], 'fps': meta['Fps'], 'loop': bool(meta.get('Loop', False)),
    }
