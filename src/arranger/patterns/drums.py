"""Hardcoded drum pattern rule library."""

from __future__ import annotations

from arranger.models.note import Note

KICK = 36
SNARE = 38
CHH = 42
OHH = 46
RIDE = 51
CRASH = 49

DRUM_PATTERNS: dict[str, dict] = {
    "4_4_basic": {
        "name": "Basic 4/4",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        },
        "velocity": {KICK: 100, SNARE: 90, CHH: 70},
        "tags": {"genre": ["pop"], "energy": "medium", "section": ["verse", "chorus"]},
    },
    "4_4_driving": {
        "name": "Driving 4/4",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
        "velocity": {KICK: 106, SNARE: 95, CHH: 68},
        "tags": {"genre": ["rock", "pop"], "energy": "high", "section": ["chorus"]},
    },
    "half_time": {
        "name": "Half-time Groove",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            SNARE: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        },
        "velocity": {KICK: 102, SNARE: 94, CHH: 64},
        "tags": {"genre": ["hiphop", "pop"], "energy": "medium", "section": ["verse"]},
    },
    "ballad": {
        "name": "Ballad Kit",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            RIDE: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        },
        "velocity": {KICK: 86, SNARE: 78, RIDE: 65},
        "tags": {"genre": ["ballad"], "energy": "low", "section": ["verse", "bridge"]},
    },
    "rock_heavy": {
        "name": "Heavy Rock",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            CRASH: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
        "velocity": {KICK: 114, SNARE: 104, CHH: 74, CRASH: 110},
        "tags": {"genre": ["rock"], "energy": "high", "section": ["chorus"]},
    },
    "funk": {
        "name": "Funk Pocket",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
            CHH: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
            OHH: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        },
        "velocity": {KICK: 100, SNARE: 96, CHH: 72, OHH: 78},
        "tags": {"genre": ["funk"], "energy": "medium", "section": ["verse", "chorus"]},
    },
    "hiphop": {
        "name": "Hiphop Groove",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
        },
        "velocity": {KICK: 104, SNARE: 92, CHH: 62},
        "tags": {"genre": ["hiphop"], "energy": "medium", "section": ["verse"]},
    },
    "latin_bossa": {
        "name": "Latin Bossa",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            SNARE: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
            CHH: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            OHH: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        },
        "velocity": {KICK: 88, SNARE: 76, CHH: 68, OHH: 73},
        "tags": {"genre": ["latin"], "energy": "medium", "section": ["verse", "bridge"]},
    },
    "jazz_swing": {
        "name": "Jazz Swing (Triplet Grid)",
        "steps": 12,
        "tracks": {
            KICK: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            SNARE: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            RIDE: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
            CHH: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        },
        "velocity": {KICK: 82, SNARE: 75, RIDE: 70, CHH: 62},
        "tags": {"genre": ["jazz"], "energy": "low", "section": ["verse", "solo"]},
    },
    "edm_four_on_floor": {
        "name": "EDM Four on the Floor",
        "steps": 16,
        "tracks": {
            KICK: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            SNARE: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            CHH: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            OHH: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            CRASH: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
        "velocity": {KICK: 120, SNARE: 88, CHH: 78, OHH: 84, CRASH: 108},
        "tags": {"genre": ["edm"], "energy": "high", "section": ["drop", "chorus"]},
    },
}


def get_drum_pattern(style: str) -> dict:
    """Return a drum pattern by style key."""
    if style in DRUM_PATTERNS:
        return DRUM_PATTERNS[style]
    raise ValueError(f"Unknown drum pattern style: '{style}'")


def drum_pattern_to_notes(pattern: dict, bar_start_tick: int, ppq: int = 480) -> list[Note]:
    """Convert one bar of grid pattern into MIDI Note events on channel 9."""
    steps = int(pattern["steps"])
    step_tick = max(1, (ppq * 4) // steps)
    duration_tick = max(1, step_tick // 2)
    velocity_map: dict[int, int] = pattern.get("velocity", {})
    tracks: dict[int, list[int]] = pattern.get("tracks", {})

    notes: list[Note] = []
    for note_number, grid in tracks.items():
        if not 0 <= int(note_number) <= 127:
            continue
        velocity = max(0, min(127, int(velocity_map.get(int(note_number), 80))))
        for idx, hit in enumerate(grid):
            if hit:
                notes.append(
                    Note(
                        note_number=int(note_number),
                        velocity=velocity,
                        start_tick=bar_start_tick + idx * step_tick,
                        duration_tick=duration_tick,
                        channel=9,
                    )
                )
    return notes
