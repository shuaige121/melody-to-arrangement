"""Hardcoded piano-comping rule library."""

from __future__ import annotations

from arranger.models.note import Note

PIANO_STYLES: dict[str, str] = {
    "block_chord": "Full chord on each beat",
    "arpeggiated": "Broken chord ascending",
    "rhythmic_stab": "Short chord stabs on beats 1 and 3",
    "ballad_spread": "Spread voicing, long sustain",
}

_PIANO_LOW = 48
_PIANO_HIGH = 84


def _fit_to_range(note_number: int, low: int = _PIANO_LOW, high: int = _PIANO_HIGH) -> int:
    while note_number < low:
        note_number += 12
    while note_number > high:
        note_number -= 12
    return max(0, min(127, note_number))


def _normalize_chord(chord: list[int]) -> list[int]:
    normalized = sorted({_fit_to_range(n) for n in chord})
    return normalized or [_fit_to_range(60)]


def _add_chord(
    notes: list[Note], chord: list[int], velocity: int, start_tick: int, duration_tick: int, channel: int = 0
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


def generate_piano_comp(chords: list[list[int]], style: str, bars: int, ppq: int = 480) -> list[Note]:
    """Generate hardcoded piano comping notes from resolved chord notes."""
    if style not in PIANO_STYLES:
        raise ValueError(f"Unknown piano style: '{style}'")
    if not chords or bars <= 0:
        return []

    bar_ticks = ppq * 4
    notes: list[Note] = []
    for bar_idx in range(bars):
        bar_start = bar_idx * bar_ticks
        chord = _normalize_chord(chords[bar_idx % len(chords)])

        if style == "block_chord":
            for beat in range(4):
                _add_chord(notes, chord, 76, bar_start + beat * ppq, ppq)
            continue

        if style == "arpeggiated":
            arp = [chord[i % len(chord)] for i in range(8)]
            for step, note_number in enumerate(arp):
                _add_chord(notes, [note_number], 72, bar_start + step * (ppq // 2), ppq // 2)
            continue

        if style == "rhythmic_stab":
            stab_duration = max(1, ppq // 2)
            _add_chord(notes, chord, 84, bar_start, stab_duration)
            _add_chord(notes, chord, 82, bar_start + 2 * ppq, stab_duration)
            continue

        if style == "ballad_spread":
            root = _fit_to_range(chord[0] - 12)
            top = [chord[1], chord[-1]] if len(chord) > 2 else chord
            spread = sorted({_fit_to_range(root), *[_fit_to_range(n) for n in top]})
            _add_chord(notes, spread, 70, bar_start, bar_ticks)

    return notes
