"""
结构分析层 / Melody analysis layer.

从主旋律 MIDI Note 列表提取可计算结构（调性、速度、拍号、密度、音域）。
Extracts computable structure (key, tempo, time signature, density, range)
from melody notes parsed from MIDI.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from arranger.models.arrangement import AnalysisResult
from arranger.models.note import Note

from arranger.analysis.structure import analyze_structure, identify_strong_beats

_PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_DEFAULT_PPQ = 480

# Krumhansl-Schmuckler key profiles (C-based)
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    dtype=float,
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
    dtype=float,
)


def _safe_attr(note: Note, name: str, default: Any = None) -> Any:
    """安全读取 Note 字段 / Safely read note attributes."""
    return getattr(note, name, default)


def _normalize_time_signature(raw: Any) -> tuple[int, int]:
    """解析拍号 / Parse time signature into (numerator, denominator)."""
    if isinstance(raw, tuple) and len(raw) == 2:
        return int(raw[0]), int(raw[1])
    if isinstance(raw, list) and len(raw) == 2:
        return int(raw[0]), int(raw[1])
    if isinstance(raw, str) and "/" in raw:
        n, d = raw.split("/", 1)
        return int(n), int(d)
    return 4, 4


def _normalize_ppq(ppq: Any) -> int:
    try:
        value = int(ppq)
    except (TypeError, ValueError):
        return _DEFAULT_PPQ
    return max(1, value)


def _normalize_tempo_bpm(raw: Any) -> int | None:
    try:
        tempo_value = int(round(float(raw)))
    except (TypeError, ValueError):
        return None
    if 20 <= tempo_value <= 300:
        return tempo_value
    return None


def _resolve_time_signature(notes: list[Note]) -> tuple[int, int]:
    """
    默认 4/4，允许从 note 元信息覆盖。
    Defaults to 4/4, allows metadata override from note objects.
    """
    if not notes:
        return 4, 4
    for attr in ("time_sig", "time_signature"):
        value = _safe_attr(notes[0], attr, None)
        if value is not None:
            return _normalize_time_signature(value)
    return 4, 4


def _bars_span(notes: list[Note], ppq: int, time_sig: tuple[int, int]) -> float:
    """计算旋律跨越小节数 / Estimate melody span in bars."""
    if not notes:
        return 1.0
    numerator, denominator = time_sig
    bar_ticks = max(int(round(ppq * numerator * (4.0 / denominator))), 1)
    start_ticks = np.array(
        [int(_safe_attr(n, "start_tick", 0)) for n in notes], dtype=float
    )
    end_ticks = np.array(
        [
            int(_safe_attr(n, "start_tick", 0))
            + max(int(_safe_attr(n, "duration_tick", 0)), 0)
            for n in notes
        ],
        dtype=float,
    )
    total_ticks = max(float(end_ticks.max() - start_ticks.min()), 1.0)
    return max(total_ticks / bar_ticks, 0.25)


def _density_value(notes: list[Note], ppq: int, time_sig: tuple[int, int]) -> float:
    """计算每小节音符数 / Compute notes per bar."""
    if not notes:
        return 0.0
    return float(len(notes) / _bars_span(notes, ppq, time_sig))


def _density_label(notes_per_bar: float) -> str:
    """密度标签 / Density label."""
    if notes_per_bar < 4:
        return "sparse"
    if notes_per_bar <= 8:
        return "medium"
    return "dense"


def _estimate_tempo(notes: list[Note], notes_per_bar: float) -> int:
    """
    速度估计 / Tempo estimation.

    没有音频绝对时间时，tick 无法直接反推出 BPM，
    这里用密度与起始间隔做启发式估计。
    Without wall-clock timing, ticks cannot fully determine BPM,
    so we use a density/IOI heuristic.
    """
    if not notes:
        return 120
    override = _safe_attr(notes[0], "tempo", None)
    if override is not None:
        try:
            tempo_value = int(override)
            if 20 <= tempo_value <= 300:
                return tempo_value
        except (TypeError, ValueError):
            pass

    starts = np.array(
        sorted(int(_safe_attr(n, "start_tick", 0)) for n in notes), dtype=float
    )
    if starts.size > 1:
        ioi = np.diff(starts)
        ioi = ioi[ioi > 0]
    else:
        ioi = np.array([], dtype=float)

    if ioi.size == 0:
        base = 120
    else:
        median_ioi = float(np.median(ioi))
        if median_ioi <= _DEFAULT_PPQ / 8:
            base = 132
        elif median_ioi <= _DEFAULT_PPQ / 4:
            base = 124
        elif median_ioi <= _DEFAULT_PPQ / 2:
            base = 116
        else:
            base = 104

    if notes_per_bar < 4:
        base -= 8
    elif notes_per_bar > 8:
        base += 8

    return int(np.clip(base, 60, 180))


def _pearson_corr(x: np.ndarray, y: np.ndarray) -> float:
    """皮尔逊相关系数 / Pearson correlation coefficient."""
    x_centered = x - x.mean()
    y_centered = y - y.mean()
    denom = float(np.linalg.norm(x_centered) * np.linalg.norm(y_centered))
    if denom <= 0:
        return 0.0
    return float(np.dot(x_centered, y_centered) / denom)


def _detect_key(notes: list[Note]) -> str:
    """
    Krumhansl-Schmuckler 调性识别。
    Krumhansl-Schmuckler key detection over 24 candidate keys.
    """
    if not notes:
        return "C_major"

    pitch_classes = [int(_safe_attr(note, "note_number", 60)) % 12 for note in notes]
    histogram = np.bincount(np.array(pitch_classes, dtype=int), minlength=12).astype(
        float
    )

    best_score = float("-inf")
    best_key = "C_major"

    for root in range(12):
        major_profile = np.roll(_MAJOR_PROFILE, root)
        minor_profile = np.roll(_MINOR_PROFILE, root)

        major_score = _pearson_corr(histogram, major_profile)
        if major_score > best_score:
            best_score = major_score
            best_key = f"{_PITCH_CLASS_NAMES[root]}_major"

        minor_score = _pearson_corr(histogram, minor_profile)
        if minor_score > best_score:
            best_score = minor_score
            best_key = f"{_PITCH_CLASS_NAMES[root]}_minor"

    return best_key


def _coerce_analysis_result(payload: dict[str, Any]) -> AnalysisResult:
    """
    兼容 Pydantic/dataclass 字段差异后构造 AnalysisResult。
    Build AnalysisResult while adapting to model field differences.
    """
    model_fields: set[str] = set()
    if hasattr(AnalysisResult, "model_fields"):
        model_fields = set(getattr(AnalysisResult, "model_fields").keys())
    elif hasattr(AnalysisResult, "__dataclass_fields__"):
        model_fields = set(getattr(AnalysisResult, "__dataclass_fields__").keys())
    elif hasattr(AnalysisResult, "__annotations__"):
        model_fields = set(getattr(AnalysisResult, "__annotations__", {}).keys())

    if model_fields:
        data: dict[str, Any] = {}
        for key in model_fields:
            if key in payload:
                data[key] = payload[key]

        if "time_sig" in model_fields:
            data.setdefault("time_sig", payload["time_sig"])
        if "time_signature" in model_fields:
            time_signature = payload.get("time_signature")
            if time_signature is not None:
                data.setdefault("time_signature", time_signature)
        if "note_density" in model_fields:
            note_density = payload.get("note_density")
            if note_density is not None:
                data.setdefault("note_density", note_density)
        if "melody_density" in model_fields:
            data.setdefault("melody_density", payload["melody_density"])
        if "melody_range" in model_fields:
            data.setdefault("melody_range", payload["melody_range"])
        if "melody_low" in model_fields:
            data.setdefault("melody_low", payload["melody_range"][0])
        if "melody_high" in model_fields:
            data.setdefault("melody_high", payload["melody_range"][1])

        return AnalysisResult(**data)

    try:
        return AnalysisResult(**payload)
    except TypeError:
        compact = {
            "key": payload["key"],
            "tempo": payload["tempo"],
            "time_sig": payload["time_sig"],
        }
        return AnalysisResult(**compact)


def analyze_melody(
    notes: list[Note],
    tempo_bpm: int | None = None,
    time_sig: tuple[int, int] | list[int] | str | None = None,
    ppq: int = _DEFAULT_PPQ,
) -> AnalysisResult:
    """
    分析主旋律并输出结构化结果（硬约束层）。
    Analyze melody and return structured analysis result (hard-constraint layer).

    Args:
        notes: 主旋律 Note 列表 / melody notes.

    Returns:
        AnalysisResult: 包含 key/tempo/time signature/range/density/sections 等信息。
    """
    resolved_time_sig = (
        _normalize_time_signature(time_sig)
        if time_sig is not None
        else _resolve_time_signature(notes)
    )
    resolved_ppq = _normalize_ppq(ppq)

    notes_per_bar = _density_value(notes, ppq=resolved_ppq, time_sig=resolved_time_sig)
    total_bars = int(
        np.ceil(_bars_span(notes, ppq=resolved_ppq, time_sig=resolved_time_sig))
    )
    key_name = _detect_key(notes)
    tempo = _normalize_tempo_bpm(tempo_bpm) or _estimate_tempo(notes, notes_per_bar)

    if notes:
        pitches = np.array(
            [int(_safe_attr(n, "note_number", 60)) for n in notes], dtype=int
        )
        melody_range = (int(pitches.min()), int(pitches.max()))
    else:
        melody_range = (0, 0)

    sections = analyze_structure(
        notes, tempo=tempo, time_sig=resolved_time_sig, ppq=resolved_ppq
    )
    strong_beats = identify_strong_beats(
        notes,
        ppq=resolved_ppq,
        beats_per_bar=resolved_time_sig[0],
        beat_unit=resolved_time_sig[1],
    )

    payload: dict[str, Any] = {
        "key": key_name,
        "tempo": tempo,
        "time_sig": resolved_time_sig,
        "total_bars": max(total_bars, 1),
        "time_signature": f"{resolved_time_sig[0]}/{resolved_time_sig[1]}",
        "melody_range": melody_range,
        "melody_density": _density_label(notes_per_bar),
        "note_density": float(notes_per_bar),
        "sections": sections,
        "strong_beats": strong_beats,
        "phrase_boundaries": [section["start_tick"] for section in sections],
        "chord_hints": [],
    }
    return _coerce_analysis_result(payload)
