"""Hardcoded bass-line rule library."""

from __future__ import annotations

from arranger.models.note import Note

BASS_STYLES: dict[str, str] = {
    "root_note": "Play root on beat 1 of each chord",
    "root_octave": "Root on beat 1, octave jump on beat 3",
    "walking": "Stepwise motion connecting chord roots",
    "arpeggio": "Arpeggiate chord tones",
    "syncopated": "Off-beat root notes",
    "pedal": "Sustain one note through changing chords",
}

_BASS_LOW = 28
_BASS_HIGH = 55


def _fit_to_range(note_number: int, low: int = _BASS_LOW, high: int = _BASS_HIGH) -> int:
    while note_number < low:
        note_number += 12
    while note_number > high:
        note_number -= 12
    return max(0, min(127, note_number))


def _add_note(notes: list[Note], note_number: int, velocity: int, start_tick: int, duration_tick: int) -> None:
    notes.append(
        Note(
            note_number=max(0, min(127, note_number)),
            velocity=max(0, min(127, velocity)),
            start_tick=max(0, start_tick),
            duration_tick=max(1, duration_tick),
            channel=1,
        )
    )


def generate_bass_line(chords: list[list[int]], style: str, bars: int, ppq: int = 480) -> list[Note]:
    """Generate hardcoded bass line notes from resolved chord notes."""
    if style not in BASS_STYLES:
        raise ValueError(f"Unknown bass style: '{style}'")
    if not chords or bars <= 0:
        return []

    bar_ticks = ppq * 4
    roots = [_fit_to_range(min(chord)) for chord in chords if chord]
    if not roots:
        return []

    notes: list[Note] = []
    pedal_note = roots[0]
    for bar_idx in range(bars):
        bar_start = bar_idx * bar_ticks
        root = roots[bar_idx % len(roots)]
        next_root = roots[(bar_idx + 1) % len(roots)]
        chord = chords[bar_idx % len(chords)]
        chord_tones = sorted({_fit_to_range(n) for n in chord}) or [root]

        if style == "root_note":
            _add_note(notes, root, 92, bar_start, ppq)
            continue

        if style == "root_octave":
            _add_note(notes, root, 92, bar_start, ppq)
            octave_note = _fit_to_range(root + 12)
            _add_note(notes, octave_note, 88, bar_start + 2 * ppq, ppq)
            continue

        if style == "walking":
            direction = 1 if next_root >= root else -1
            mid1 = _fit_to_range(root + (2 * direction))
            mid2 = _fit_to_range(root + (4 * direction))
            walking_notes = [root, mid1, mid2, next_root]
            for beat, note_number in enumerate(walking_notes):
                _add_note(notes, note_number, 86, bar_start + beat * ppq, ppq)
            continue

        if style == "arpeggio":
            arp = [chord_tones[i % len(chord_tones)] for i in range(4)]
            for beat, note_number in enumerate(arp):
                _add_note(notes, note_number, 84, bar_start + beat * ppq, ppq)
            continue

        if style == "syncopated":
            off_beats = [ppq // 2, ppq + ppq // 2, 2 * ppq + ppq // 2, 3 * ppq + ppq // 2]
            for offset in off_beats:
                _add_note(notes, root, 88, bar_start + offset, ppq // 2)
            continue

        if style == "pedal":
            _add_note(notes, pedal_note, 82, bar_start, bar_ticks)

    return notes
