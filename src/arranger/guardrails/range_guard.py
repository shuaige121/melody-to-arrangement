"""音域栅栏 — 确保音符在乐器合法音域内"""

from __future__ import annotations

from arranger.models.note import Note


def check_range(note: Note, low: int, high: int) -> bool:
    return low <= note.note_number <= high


def fix_range(note: Note, low: int, high: int) -> Note:
    if low > high:
        raise ValueError(f"Invalid range: low={low}, high={high}")

    fixed_note_number = min(max(note.note_number, low), high)

    while fixed_note_number < low:
        fixed_note_number += 12
    while fixed_note_number > high:
        fixed_note_number -= 12

    fixed_note_number = min(max(fixed_note_number, low), high)
    return note.model_copy(update={"note_number": fixed_note_number})
