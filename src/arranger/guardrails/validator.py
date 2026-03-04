"""统一验证器 — 组合所有栅栏，一次性验证+修正"""

from __future__ import annotations

import logging

from arranger.guardrails.harmony_guard import check_harmony, fix_harmony
from arranger.guardrails.key_guard import SCALE_PITCH_CLASSES, check_key, fix_key
from arranger.guardrails.range_guard import check_range, fix_range
from arranger.guardrails.rhythm_guard import check_rhythm, fix_rhythm, quantize_duration
from arranger.models.guardrail import GuardrailSet
from arranger.models.note import Note

logger = logging.getLogger(__name__)

DEFAULT_NOTE_RANGES: dict[str, tuple[int, int]] = {
    "bass": (28, 55),
    "piano": (48, 84),
    "strings": (55, 96),
    "drums": (35, 81),
}


def _resolve_track_range(guardrails: GuardrailSet) -> tuple[int, int]:
    if guardrails.note_ranges:
        return next(iter(guardrails.note_ranges.values()))
    return (0, 127)


def validate_and_fix(
    notes: list[Note], guardrails: GuardrailSet, chord_notes: list[int] | None = None
) -> list[Note]:
    corrected_notes: list[Note] = []
    low, high = _resolve_track_range(guardrails)

    for idx, original_note in enumerate(notes):
        current_note = original_note

        if not check_key(current_note, guardrails.allowed_pitch_classes):
            current_note = fix_key(current_note, guardrails.allowed_pitch_classes)

        if chord_notes and not check_harmony(current_note, chord_notes):
            current_note = fix_harmony(current_note, chord_notes)

        if not check_range(current_note, low, high):
            current_note = fix_range(current_note, low, high)

        if not check_rhythm(current_note, guardrails.tick_grid):
            current_note = fix_rhythm(current_note, guardrails.tick_grid)

        quantized_note = quantize_duration(current_note, guardrails.tick_grid)
        if quantized_note.duration_tick != current_note.duration_tick:
            current_note = quantized_note

        if current_note != original_note:
            logger.info(
                "Corrected note[%d]: %s -> %s",
                idx,
                original_note.model_dump(),
                current_note.model_dump(),
            )

        corrected_notes.append(current_note)

    return corrected_notes


def create_guardrails(key: str, track_name: str = "piano") -> GuardrailSet:
    if key not in SCALE_PITCH_CLASSES:
        raise ValueError(
            f"Unsupported key '{key}'. Supported keys: {', '.join(sorted(SCALE_PITCH_CLASSES))}"
        )

    note_range = DEFAULT_NOTE_RANGES.get(track_name, DEFAULT_NOTE_RANGES["piano"])
    return GuardrailSet(
        key_name=key,
        allowed_pitch_classes=set(SCALE_PITCH_CLASSES[key]),
        tick_grid=120,
        note_ranges={track_name: note_range},
        velocity_range=(40, 120),
    )
