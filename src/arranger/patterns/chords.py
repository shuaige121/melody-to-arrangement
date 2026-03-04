"""Hardcoded chord progression and chord-voicing rule library."""

from __future__ import annotations

import re

COMMON_PROGRESSIONS: dict[str, list[list[str]]] = {
    "pop": [
        ["I", "V", "vi", "IV"],
        ["vi", "IV", "I", "V"],
        ["I", "IV", "V", "I"],
        ["I", "vi", "IV", "V"],
        ["I", "IV", "vi", "V"],
    ],
    "rock": [
        ["I", "IV", "V", "IV"],
        ["I", "bVII", "IV", "I"],
        ["i", "bVI", "bVII", "i"],
    ],
    "ballad": [
        ["I", "V/1", "vi", "IV"],
        ["I", "iii", "IV", "V"],
        ["vi", "IV", "I", "V"],
    ],
    "jazz": [
        ["ii", "V", "I", "I"],
        ["I", "vi", "ii", "V"],
        ["iii", "vi", "ii", "V"],
    ],
    "edm": [
        ["i", "VI", "III", "VII"],
        ["I", "V", "vi", "IV"],
        ["vi", "I", "V", "IV"],
    ],
    "rnb": [
        ["I", "iii", "vi", "IV"],
        ["ii", "V", "I", "vi"],
        ["vi", "V", "IV", "V"],
    ],
    "country": [
        ["I", "IV", "V", "I"],
        ["I", "V", "IV", "I"],
        ["I", "vi", "IV", "V"],
    ],
    "latin": [
        ["i", "iv", "V", "i"],
        ["I", "V", "IV", "V"],
        ["ii", "V", "I", "I"],
    ],
}

CHORD_INTERVALS: dict[str, list[int]] = {
    "major": [0, 4, 7],
    "minor": [0, 3, 7],
    "dim": [0, 3, 6],
    "aug": [0, 4, 8],
    "dom7": [0, 4, 7, 10],
    "maj7": [0, 4, 7, 11],
    "min7": [0, 3, 7, 10],
    "sus2": [0, 2, 7],
    "sus4": [0, 5, 7],
}

MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

MAJOR_DEGREE_TYPES = ["major", "minor", "minor", "major", "major", "minor", "dim"]
MINOR_DEGREE_TYPES = ["minor", "dim", "major", "minor", "minor", "major", "major"]

SCALE_DEGREES: dict[str, list[int]] = {
    "major": MAJOR_SCALE,
    "minor": MINOR_SCALE,
}

_NOTE_TO_SEMITONE = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "E#": 5,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
}

_ROMAN_TO_DEGREE = {
    "i": 1,
    "ii": 2,
    "iii": 3,
    "iv": 4,
    "v": 5,
    "vi": 6,
    "vii": 7,
}

_ROMAN_RE = re.compile(r"^([b#]*)([ivIV]+)(maj7|min7|dom7|sus2|sus4|dim|aug|7|°)?$")


def _clamp_midi(note_number: int) -> int:
    return max(0, min(127, note_number))


def _parse_key(key: str) -> tuple[int, str]:
    """Return (root pitch class, mode) from key like C_major or F#_minor."""
    try:
        tonic, mode = key.split("_", 1)
    except ValueError as exc:
        raise ValueError(f"Invalid key '{key}', expected format like C_major") from exc
    if tonic not in _NOTE_TO_SEMITONE:
        raise ValueError(f"Unsupported tonic '{tonic}'")
    mode = mode.lower()
    if mode not in {"major", "minor"}:
        raise ValueError(f"Unsupported mode '{mode}'")
    return _NOTE_TO_SEMITONE[tonic], mode


def _quality_from_suffix(
    suffix: str | None, roman: str, default_quality: str, has_accidental: bool
) -> str:
    if suffix in {"°", "dim"}:
        return "dim"
    if suffix == "aug":
        return "aug"
    if suffix == "maj7":
        return "maj7"
    if suffix == "min7":
        return "min7"
    if suffix == "dom7":
        return "dom7"
    if suffix == "sus2":
        return "sus2"
    if suffix == "sus4":
        return "sus4"
    if suffix == "7":
        return "dom7" if roman[0].isupper() else "min7"

    case_quality = "major" if roman[0].isupper() else "minor"
    if default_quality == "dim" and not has_accidental:
        return "dim"
    if has_accidental:
        return case_quality
    if case_quality != default_quality:
        return case_quality
    return default_quality


def _apply_bass_degree(
    notes: list[int],
    bass_degree: int | None,
    key_root_pc: int,
    scale: list[int],
    root_midi_c_octave: int,
) -> list[int]:
    if bass_degree is None:
        return notes
    bass_pc = (key_root_pc + scale[bass_degree - 1]) % 12
    bass_note = root_midi_c_octave + scale[bass_degree - 1]
    while bass_note % 12 != bass_pc:
        bass_note += 12
    while bass_note >= notes[0]:
        bass_note -= 12
    bass_note = _clamp_midi(bass_note)
    return sorted([bass_note, *notes])


def resolve_progression(
    progression: list[str], key: str, octave: int = 4
) -> list[list[int]]:
    """
    Resolve roman numerals to MIDI note-number chord voicings.

    Example:
        resolve_progression(["I","V","vi","IV"], "C_major")
        -> [[60,64,67], [67,71,74], [69,72,76], [65,69,72]]
    """
    key_root_pc, mode = _parse_key(key)
    scale = MAJOR_SCALE if mode == "major" else MINOR_SCALE
    degree_types = MAJOR_DEGREE_TYPES if mode == "major" else MINOR_DEGREE_TYPES
    root_midi_c_octave = (octave + 1) * 12 + key_root_pc

    resolved: list[list[int]] = []
    for symbol in progression:
        base_symbol, _, bass_part = symbol.partition("/")
        bass_degree = int(bass_part) if bass_part.isdigit() and 1 <= int(bass_part) <= 7 else None

        match = _ROMAN_RE.match(base_symbol)
        if not match:
            raise ValueError(f"Unsupported roman numeral symbol: '{symbol}'")

        accidental, roman, suffix = match.groups()
        degree = _ROMAN_TO_DEGREE.get(roman.lower())
        if degree is None:
            raise ValueError(f"Unsupported roman numeral degree: '{roman}'")

        accidental_shift = accidental.count("#") - accidental.count("b")
        degree_root = key_root_pc + scale[degree - 1] + accidental_shift
        default_quality = degree_types[degree - 1]
        quality = _quality_from_suffix(
            suffix=suffix,
            roman=roman,
            default_quality=default_quality,
            has_accidental=bool(accidental),
        )

        intervals = CHORD_INTERVALS.get(quality)
        if intervals is None:
            raise ValueError(f"Unsupported chord quality '{quality}' in symbol '{symbol}'")

        chord_root_midi = (octave + 1) * 12 + degree_root
        chord_notes = [_clamp_midi(chord_root_midi + interval) for interval in intervals]
        chord_notes = _apply_bass_degree(
            notes=chord_notes,
            bass_degree=bass_degree,
            key_root_pc=key_root_pc,
            scale=scale,
            root_midi_c_octave=root_midi_c_octave,
        )
        resolved.append(chord_notes)

    return resolved
