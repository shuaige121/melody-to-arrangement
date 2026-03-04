from __future__ import annotations

import math
from pathlib import Path

import mido

from arranger.midi.builder import build_midi
from arranger.midi.parser import parse_midi
from arranger.models.arrangement import Arrangement, Track
from arranger.models.note import Note

ROLE_CHANNELS = {
    "drums": 9,
    "bass": 1,
    "piano": 0,
    "strings": 3,
    "lead": 2,
}

ROLE_PROGRAMS = {
    "drums": 0,
    "bass": 33,
    "piano": 0,
    "strings": 48,
    "lead": 80,
}


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _infer_role(track_name: str) -> str:
    lower = track_name.lower()
    if "drum" in lower or "perc" in lower or "kit" in lower:
        return "drums"
    if "bass" in lower:
        return "bass"
    if "string" in lower or "pad" in lower:
        return "strings"
    if "lead" in lower or "melody" in lower or "vocal" in lower:
        return "lead"
    if "piano" in lower or "keys" in lower or "keyboard" in lower:
        return "piano"
    return "piano"


def _next_free_channel(used_channels: set[int]) -> int:
    for channel in range(16):
        if channel == 9:
            continue
        if channel not in used_channels:
            return channel
    return 0


def _assign_channel(role: str, used_channels: set[int]) -> int:
    preferred = ROLE_CHANNELS.get(role, 0)
    if preferred == 9:
        return 9
    if preferred not in used_channels:
        return preferred
    return _next_free_channel(used_channels)


def _normalize_tempo(value: object) -> int:
    tempo = _as_int(value, 120)
    if tempo > 1000:
        return max(1, int(round(mido.tempo2bpm(tempo))))
    return max(1, tempo)


def _normalize_time_sig(value: object) -> tuple[int, int]:
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        numerator = max(1, _as_int(value[0], 4))
        denominator = max(1, _as_int(value[1], 4))
        return (numerator, denominator)
    return (4, 4)


def _max_end_tick(notes: list[Note]) -> int:
    end_tick = 0
    for note in notes:
        start = max(0, _as_int(getattr(note, "start_tick", 0), 0))
        duration = max(0, _as_int(getattr(note, "duration_tick", 0), 0))
        end_tick = max(end_tick, start + duration)
    return end_tick


def merge_tracks(track_notes: dict[str, list[Note]], arrangement_meta: dict) -> Arrangement:
    """
    将轨道 note 映射合并为 Arrangement。
    """

    ppq = max(1, _as_int(arrangement_meta.get("ppq", 480), 480))
    time_sig = _normalize_time_sig(arrangement_meta.get("time_sig", (4, 4)))
    tempo = _normalize_tempo(arrangement_meta.get("tempo", 120))

    tracks: list[Track] = []
    used_channels: set[int] = set()
    all_notes: list[Note] = []

    for track_name, notes in track_notes.items():
        safe_name = str(track_name or "track")
        role = _infer_role(safe_name)
        channel = _assign_channel(role, used_channels)
        used_channels.add(channel)
        program = ROLE_PROGRAMS.get(role, 0)

        sorted_notes = sorted(
            notes or [],
            key=lambda n: (
                _as_int(getattr(n, "start_tick", 0), 0),
                _as_int(getattr(n, "channel", 0), 0),
                _as_int(getattr(n, "note_number", 0), 0),
            ),
        )
        all_notes.extend(sorted_notes)
        tracks.append(Track(name=safe_name, channel=channel, program=program, notes=sorted_notes))

    ticks_per_bar = int(ppq * (time_sig[0] * (4 / time_sig[1]))) if time_sig[1] > 0 else ppq * 4
    max_end_tick = _max_end_tick(all_notes)
    inferred_bars = max(1, math.ceil(max_end_tick / ticks_per_bar)) if ticks_per_bar > 0 else 1
    total_bars = max(1, _as_int(arrangement_meta.get("total_bars", inferred_bars), inferred_bars))

    return Arrangement(
        tracks=tracks,
        tempo=tempo,
        time_sig=time_sig,
        ppq=ppq,
        total_bars=total_bars,
    )


def combine_midi_files(filepaths: list[str], output_path: str) -> str:
    """
    合并多个单轨 MIDI 为一个多轨 MIDI。
    """

    merged_track_notes: dict[str, list[Note]] = {}
    merged_meta: dict = {}
    name_counts: dict[str, int] = {}

    for filepath in filepaths:
        notes, metadata = parse_midi(filepath)
        if not merged_meta:
            merged_meta = dict(metadata)

        stem = Path(filepath).stem or "track"
        count = name_counts.get(stem, 0)
        name_counts[stem] = count + 1
        track_name = stem if count == 0 else f"{stem}_{count + 1}"
        merged_track_notes[track_name] = notes

    arrangement = merge_tracks(merged_track_notes, merged_meta)
    return build_midi(arrangement, output_path)
