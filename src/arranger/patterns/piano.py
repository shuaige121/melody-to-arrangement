"""Hardcoded piano-comping rule library."""

from __future__ import annotations

from arranger.models.note import Note
from arranger.patterns.timing import (
    beat_ticks,
    normalize_time_sig,
    primary_beat_indices,
    bar_ticks,
)

PIANO_STYLES: dict[str, str] = {
    "block_chord": "Full chord on each beat",
    "arpeggiated": "Broken chord ascending",
    "rhythmic_stab": "Short chord stabs on beats 1 and 3",
    "ballad_spread": "Spread voicing, long sustain",
}

_PIANO_LOW = 48
_PIANO_HIGH = 84


def _fit_to_range(
    note_number: int, low: int = _PIANO_LOW, high: int = _PIANO_HIGH
) -> int:
    if high - low < 12:
        return max(0, min(127, max(low, min(high, note_number))))
    while note_number < low:
        note_number += 12
    while note_number > high:
        note_number -= 12
    return max(0, min(127, note_number))


def _normalize_chord(chord: list[int]) -> list[int]:
    normalized = sorted({_fit_to_range(n) for n in chord})
    return normalized or [_fit_to_range(60)]


def _add_chord(
    notes: list[Note],
    chord: list[int],
    velocity: int,
    start_tick: int,
    duration_tick: int,
    channel: int = 0,
) -> None:
    for note_number in chord:
        notes.append(
            Note(
                note_number=max(0, min(127, note_number)),
                velocity=max(0, min(127, velocity)),
                start_tick=max(0, start_tick),
                duration_tick=max(1, duration_tick),
                channel=channel,
            )
        )


def generate_piano_comp(
    chords: list[list[int]],
    style: str,
    bars: int,
    ppq: int = 480,
    time_sig: tuple[int, int] = (4, 4),
) -> list[Note]:
    """Generate hardcoded piano comping notes from resolved chord notes."""
    if style not in PIANO_STYLES:
        raise ValueError(f"Unknown piano style: '{style}'")
    if not chords or bars <= 0:
        return []

    beats_per_bar, _ = normalize_time_sig(time_sig)
    beat_tick = beat_ticks(ppq, time_sig)
    bar_tick_count = bar_ticks(ppq, time_sig)
    strong_beats = primary_beat_indices(time_sig)
    eighth_tick = max(1, min(beat_tick, ppq // 2))
    notes: list[Note] = []
    for bar_idx in range(bars):
        bar_start = bar_idx * bar_tick_count
        chord = _normalize_chord(chords[bar_idx % len(chords)])

        if style == "block_chord":
            for beat in range(beats_per_bar):
                _add_chord(notes, chord, 76, bar_start + beat * beat_tick, beat_tick)
            continue

        if style == "arpeggiated":
            steps_per_bar = max(1, bar_tick_count // eighth_tick)
            arp = [chord[i % len(chord)] for i in range(steps_per_bar)]
            for step, note_number in enumerate(arp):
                _add_chord(
                    notes,
                    [note_number],
                    72,
                    bar_start + step * eighth_tick,
                    eighth_tick,
                )
            continue

        if style == "rhythmic_stab":
            stab_duration = max(1, beat_tick // 2)
            _add_chord(notes, chord, 84, bar_start, stab_duration)
            accent_beat = (
                strong_beats[1] if len(strong_beats) > 1 else max(0, beats_per_bar - 1)
            )
            _add_chord(
                notes, chord, 82, bar_start + accent_beat * beat_tick, stab_duration
            )
            continue

        if style == "ballad_spread":
            root = _fit_to_range(chord[0] - 12)
            top = [chord[1], chord[-1]] if len(chord) > 2 else chord
            spread = sorted({_fit_to_range(root), *[_fit_to_range(n) for n in top]})
            _add_chord(notes, spread, 70, bar_start, bar_tick_count)

    return notes
