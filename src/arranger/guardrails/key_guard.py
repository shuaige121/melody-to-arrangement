"""调性栅栏 — 确保音符在调内"""

from __future__ import annotations

from arranger.models.note import Note

MAJOR_INTERVALS = (0, 2, 4, 5, 7, 9, 11)
MINOR_INTERVALS = (0, 2, 3, 5, 7, 8, 10)

ROOTS = {
    "C": 0,
    "C#": 1,
    "D": 2,
    "D#": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "G": 7,
    "G#": 8,
    "A": 9,
    "A#": 10,
    "B": 11,
}


def _build_scale(root: int, intervals: tuple[int, ...]) -> set[int]:
    return {(root + interval) % 12 for interval in intervals}


SCALE_PITCH_CLASSES: dict[str, set[int]] = {
    **{f"{name}_major": _build_scale(root, MAJOR_INTERVALS) for name, root in ROOTS.items()},
    **{f"{name}_minor": _build_scale(root, MINOR_INTERVALS) for name, root in ROOTS.items()},
}


def check_key(note: Note, allowed: set[int]) -> bool:
    return note.note_number % 12 in allowed


def fix_key(note: Note, allowed: set[int]) -> Note:
    if not allowed:
        return note.model_copy()

    candidates = [n for n in range(128) if n % 12 in allowed]
    fixed_note_number = min(
        candidates,
        key=lambda candidate: (abs(candidate - note.note_number), candidate > note.note_number),
    )
    return note.model_copy(update={"note_number": fixed_note_number})
