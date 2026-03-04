from pydantic import BaseModel, Field


class GuardrailSet(BaseModel):
    """Hard constraints for MIDI generation — the 'fence'."""

    key_name: str
    allowed_pitch_classes: set[int]  # mod 12 values, e.g. {0,2,4,5,7,9,11} for C major
    tick_grid: int = 120  # quantize to this (120 = 16th note at PPQ480)
    note_ranges: dict[str, tuple[int, int]] = {
        "bass": (28, 55),
        "piano": (48, 84),
        "strings": (55, 96),
        "drums": (35, 81),
    }
    velocity_range: tuple[int, int] = (40, 120)
