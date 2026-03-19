from __future__ import annotations


def normalize_time_sig(raw: object) -> tuple[int, int]:
    if isinstance(raw, (tuple, list)) and len(raw) >= 2:
        numerator = max(1, int(raw[0]))
        denominator = max(1, int(raw[1]))
        return numerator, denominator
    return (4, 4)


def beat_ticks(ppq: int, time_sig: tuple[int, int] = (4, 4)) -> int:
    numerator, denominator = normalize_time_sig(time_sig)
    del numerator
    return max(1, int(round(ppq * 4 / denominator)))


def bar_ticks(ppq: int, time_sig: tuple[int, int] = (4, 4)) -> int:
    numerator, _ = normalize_time_sig(time_sig)
    return max(1, beat_ticks(ppq, time_sig) * numerator)


def primary_beat_indices(time_sig: tuple[int, int] = (4, 4)) -> list[int]:
    beats_per_bar, _ = normalize_time_sig(time_sig)
    if beats_per_bar >= 6:
        return [0, beats_per_bar // 2]
    if beats_per_bar >= 4:
        return [0, 2]
    return [0]


def backbeat_indices(time_sig: tuple[int, int] = (4, 4)) -> list[int]:
    beats_per_bar, _ = normalize_time_sig(time_sig)
    if beats_per_bar >= 6:
        return [beats_per_bar // 2]
    if beats_per_bar == 3:
        return [1]
    return [beat for beat in (1, 3) if beat < beats_per_bar]
