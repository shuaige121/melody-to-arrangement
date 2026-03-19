"""Hardcoded bass-line rule library."""

from __future__ import annotations

from arranger.models.note import Note
from arranger.patterns.timing import beat_ticks, normalize_time_sig, primary_beat_indices, bar_ticks

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


def generate_bass_line(
    chords: list[list[int]],
    style: str,
    bars: int,
    ppq: int = 480,
    time_sig: tuple[int, int] = (4, 4),
) -> list[Note]:
    """Generate hardcoded bass line notes from resolved chord notes."""
    if style not in BASS_STYLES:
        raise ValueError(f"Unknown bass style: '{style}'")
    if not chords or bars <= 0:
        return []

    beats_per_bar, _ = normalize_time_sig(time_sig)
    beat_tick = beat_ticks(ppq, time_sig)
    bar_tick_count = bar_ticks(ppq, time_sig)
    strong_beats = primary_beat_indices(time_sig)
    roots = [_fit_to_range(min(chord)) for chord in chords if chord]
    if not roots:
        return []

    notes: list[Note] = []
    pedal_note = roots[0]
    for bar_idx in range(bars):
        bar_start = bar_idx * bar_tick_count
        root = roots[bar_idx % len(roots)]
        next_root = roots[(bar_idx + 1) % len(roots)]
        chord = chords[bar_idx % len(chords)]
        chord_tones = sorted({_fit_to_range(n) for n in chord}) or [root]

        if style == "root_note":
            _add_note(notes, root, 92, bar_start, beat_tick)
            continue

        if style == "root_octave":
            _add_note(notes, root, 92, bar_start, beat_tick)
            octave_note = _fit_to_range(root + 12)
            accent_beat = strong_beats[1] if len(strong_beats) > 1 else max(0, beats_per_bar - 1)
            _add_note(notes, octave_note, 88, bar_start + accent_beat * beat_tick, beat_tick)
            continue

        if style == "walking":
            direction = 1 if next_root >= root else -1
            mid1 = _fit_to_range(root + (2 * direction))
            mid2 = _fit_to_range(root + (4 * direction))
            walking_notes = [root, mid1, mid2, next_root]
            for beat in range(beats_per_bar):
                note_number = walking_notes[beat % len(walking_notes)]
                _add_note(notes, note_number, 86, bar_start + beat * beat_tick, beat_tick)
            continue

        if style == "arpeggio":
            arp = [chord_tones[i % len(chord_tones)] for i in range(beats_per_bar)]
            for beat, note_number in enumerate(arp):
                _add_note(notes, note_number, 84, bar_start + beat * beat_tick, beat_tick)
            continue

        if style == "syncopated":
            offbeat_tick = max(1, beat_tick // 2)
            for beat in range(beats_per_bar):
                offset = bar_start + beat * beat_tick + offbeat_tick
                if offset >= bar_start + bar_tick_count:
                    break
                _add_note(notes, root, 88, offset, offbeat_tick)
            continue

        if style == "pedal":
            _add_note(notes, pedal_note, 82, bar_start, bar_tick_count)

    return notes
