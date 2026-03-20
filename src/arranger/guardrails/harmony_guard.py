"""和声栅栏 — 确保音符与当前和弦兼容"""

from __future__ import annotations

from arranger.models.note import Note


def check_harmony(note: Note, chord_notes: list[int]) -> bool:
    chord_pitch_classes = {pitch % 12 for pitch in chord_notes}
    return note.note_number % 12 in chord_pitch_classes


def fix_harmony(note: Note, chord_notes: list[int]) -> Note:
    chord_pitch_classes = {pitch % 12 for pitch in chord_notes}
    if not chord_pitch_classes:
        return note.model_copy()

    candidates = [n for n in range(128) if n % 12 in chord_pitch_classes]
    fixed_note_number = min(
        candidates,
        key=lambda candidate: (
            abs(candidate - note.note_number),
            candidate > note.note_number,
        ),
    )
    return note.model_copy(update={"note_number": fixed_note_number})
