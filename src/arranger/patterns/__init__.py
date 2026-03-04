"""Pattern rule libraries for arranger."""

from .bass import BASS_STYLES, generate_bass_line
from .chords import (
    CHORD_INTERVALS,
    COMMON_PROGRESSIONS,
    MAJOR_DEGREE_TYPES,
    MAJOR_SCALE,
    MINOR_DEGREE_TYPES,
    MINOR_SCALE,
    SCALE_DEGREES,
    resolve_progression,
)
from .drums import DRUM_PATTERNS, drum_pattern_to_notes, get_drum_pattern
from .piano import PIANO_STYLES, generate_piano_comp

__all__ = [
    "COMMON_PROGRESSIONS",
    "CHORD_INTERVALS",
    "MAJOR_SCALE",
    "MINOR_SCALE",
    "MAJOR_DEGREE_TYPES",
    "MINOR_DEGREE_TYPES",
    "SCALE_DEGREES",
    "resolve_progression",
    "DRUM_PATTERNS",
    "get_drum_pattern",
    "drum_pattern_to_notes",
    "BASS_STYLES",
    "generate_bass_line",
    "PIANO_STYLES",
    "generate_piano_comp",
]
