"""
编曲主流程 — 串联 4 层架构：
  分析 → 策略选择 → 套路生成 → MIDI 输出
"""

from __future__ import annotations

from typing import Any

import mido

from arranger.analysis.melody import analyze_melody
from arranger.engine.llm import get_strategy
from arranger.midi.builder import build_midi
from arranger.midi.parser import parse_midi
from arranger.models.arrangement import Arrangement, Track
from arranger.models.note import Note
from arranger.patterns.bass import generate_bass_line
from arranger.patterns.chords import resolve_progression
from arranger.patterns.drums import DRUM_PATTERNS, drum_pattern_to_notes
from arranger.patterns.piano import generate_piano_comp

try:
    from arranger.guardrails.validator import validate_and_fix, create_guardrails
except ImportError:
    validate_and_fix = None
    create_guardrails = None

DEFAULT_PPQ = 480
DEFAULT_TIME_SIG = (4, 4)


def _normalize_time_sig(raw: Any) -> tuple[int, int]:
    if isinstance(raw, (tuple, list)) and len(raw) == 2:
        numerator = max(1, int(raw[0]))
        denominator = max(1, int(raw[1]))
        return numerator, denominator
    return DEFAULT_TIME_SIG


def _resolve_tempo_bpm(metadata: dict[str, Any], analysis_tempo: int) -> int:
    microseconds_per_beat = metadata.get("tempo")
    try:
        if microseconds_per_beat:
            return int(round(mido.tempo2bpm(int(microseconds_per_beat))))
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    return max(20, min(300, int(analysis_tempo or 120)))


def _parse_progression_symbols(progression_style: str) -> list[str]:
    symbols = [piece.strip() for piece in (progression_style or "").split("-") if piece.strip()]
    return symbols or ["I", "V", "vi", "IV"]


def _resolve_drum_pattern(style_name: str) -> dict[str, Any]:
    if style_name in DRUM_PATTERNS:
        return DRUM_PATTERNS[style_name]
    first_key = next(iter(DRUM_PATTERNS))
    return DRUM_PATTERNS[first_key]


def _build_drum_track(pattern: dict[str, Any], bars: int, ppq: int) -> list[Note]:
    bar_ticks = max(1, ppq * 4)
    notes: list[Note] = []
    for bar_idx in range(max(1, bars)):
        notes.extend(drum_pattern_to_notes(pattern, bar_idx * bar_ticks, ppq))
    return notes


def _validate_track_notes(notes: list[Note], analysis: Any, strategy: Any, track_name: str) -> list[Note]:
    if validate_and_fix is None:
        return notes

    guardrails = None
    if create_guardrails is not None:
        try:
            guardrails = create_guardrails(analysis=analysis, strategy=strategy, track_name=track_name)
        except TypeError:
            try:
                guardrails = create_guardrails(analysis, strategy, track_name)
            except Exception:
                guardrails = None
        except Exception:
            guardrails = None

    call_attempts = [
        {"kwargs": {"notes": notes, "guardrails": guardrails, "track_name": track_name}},
        {"kwargs": {"notes": notes, "guardrails": guardrails}},
        {"kwargs": {"notes": notes}},
        {"args": (notes, guardrails, track_name)},
        {"args": (notes, guardrails)},
        {"args": (notes,)},
    ]
    for attempt in call_attempts:
        try:
            if "kwargs" in attempt:
                result = validate_and_fix(**attempt["kwargs"])
            else:
                result = validate_and_fix(*attempt["args"])
            if isinstance(result, list):
                return result
        except TypeError:
            continue
        except Exception:
            return notes

    return notes


def arrange_melody(
    input_path: str,
    output_path: str,
    style: str = "pop",
    mood: str = "neutral",
) -> str:
    """
    Main arrangement pipeline:
      1) Parse input MIDI
      2) Analyze melody
      3) Get LLM strategy (or fallback)
      4) Resolve progression to chord note numbers
      5) Generate drums/bass/piano tracks
      6) Validate tracks with guardrails when available
      7) Build Arrangement object
      8) Write output MIDI
    """

    notes, metadata = parse_midi(input_path)
    if not notes:
        raise ValueError(f"No notes found in input MIDI: {input_path}")

    analysis = analyze_melody(notes)
    strategy = get_strategy(analysis=analysis, style=style, mood=mood)

    progression_symbols = _parse_progression_symbols(strategy.progression_style)
    chords = resolve_progression(progression_symbols, key=analysis.key)

    ppq = max(1, int(metadata.get("ppq", DEFAULT_PPQ)))
    total_bars = max(1, int(getattr(analysis, "total_bars", 1) or 1))

    drum_pattern = _resolve_drum_pattern(strategy.drum_style)
    drum_notes = _build_drum_track(pattern=drum_pattern, bars=total_bars, ppq=ppq)
    bass_notes = generate_bass_line(chords=chords, style=strategy.bass_style, bars=total_bars, ppq=ppq)
    piano_notes = generate_piano_comp(chords=chords, style=strategy.piano_style, bars=total_bars, ppq=ppq)

    drum_notes = _validate_track_notes(drum_notes, analysis=analysis, strategy=strategy, track_name="drums")
    bass_notes = _validate_track_notes(bass_notes, analysis=analysis, strategy=strategy, track_name="bass")
    piano_notes = _validate_track_notes(piano_notes, analysis=analysis, strategy=strategy, track_name="piano")

    arrangement = Arrangement(
        tracks=[
            Track(name="Drums", channel=9, program=0, notes=drum_notes),
            Track(name="Bass", channel=1, program=34, notes=bass_notes),
            Track(name="Piano", channel=0, program=0, notes=piano_notes),
        ],
        tempo=_resolve_tempo_bpm(metadata=metadata, analysis_tempo=analysis.tempo),
        time_sig=_normalize_time_sig(metadata.get("time_sig", getattr(analysis, "time_sig", DEFAULT_TIME_SIG))),
        ppq=ppq,
        total_bars=total_bars,
        metadata={
            "source_midi": input_path,
            "key": analysis.key,
            "requested_style": style,
            "requested_mood": mood,
            "strategy": strategy.model_dump() if hasattr(strategy, "model_dump") else dict(strategy),
        },
    )
    return build_midi(arrangement=arrangement, output_path=output_path)


__all__ = ["arrange_melody"]

