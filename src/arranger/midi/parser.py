"""
MIDI 解析器 — 读取 .mid 文件，输出 Note[] 列表。
将 delta_time 转为 absolute tick，提取 tempo/time_sig。
"""

from __future__ import annotations

from collections import defaultdict, deque

import mido

from arranger.models.note import Note

DEFAULT_TEMPO = 500000
DEFAULT_TIME_SIG = (4, 4)


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _build_note(note_number: int, velocity: int, start_tick: int, duration_tick: int, channel: int) -> Note:
    return Note(
        note_number=note_number,
        velocity=max(1, velocity),
        start_tick=max(0, start_tick),
        duration_tick=max(1, duration_tick),
        channel=max(0, min(15, channel)),
    )


def _parse_track(track: mido.MidiTrack) -> tuple[list[Note], int | None, tuple[int, int] | None]:
    notes: list[Note] = []
    absolute_tick = 0
    active_notes: dict[tuple[int, int], deque[tuple[int, int]]] = defaultdict(deque)
    track_tempo: int | None = None
    track_time_sig: tuple[int, int] | None = None

    for msg in track:
        absolute_tick += _as_int(getattr(msg, "time", 0), 0)

        if msg.type == "set_tempo" and track_tempo is None:
            track_tempo = _as_int(getattr(msg, "tempo", DEFAULT_TEMPO), DEFAULT_TEMPO)
            continue

        if msg.type == "time_signature" and track_time_sig is None:
            numerator = _as_int(getattr(msg, "numerator", DEFAULT_TIME_SIG[0]), DEFAULT_TIME_SIG[0])
            denominator = _as_int(getattr(msg, "denominator", DEFAULT_TIME_SIG[1]), DEFAULT_TIME_SIG[1])
            track_time_sig = (max(1, numerator), max(1, denominator))
            continue

        if msg.type not in {"note_on", "note_off"}:
            continue

        channel = _as_int(getattr(msg, "channel", 0), 0)
        note_number = _as_int(getattr(msg, "note", 60), 60)
        velocity = _as_int(getattr(msg, "velocity", 0), 0)
        key = (channel, note_number)

        if msg.type == "note_on" and velocity > 0:
            active_notes[key].append((absolute_tick, velocity))
            continue

        if not active_notes[key]:
            continue

        start_tick, start_velocity = active_notes[key].popleft()
        notes.append(
            _build_note(
                note_number=note_number,
                velocity=start_velocity,
                start_tick=start_tick,
                duration_tick=absolute_tick - start_tick,
                channel=channel,
            )
        )

    for (channel, note_number), start_events in active_notes.items():
        while start_events:
            start_tick, start_velocity = start_events.popleft()
            notes.append(
                _build_note(
                    note_number=note_number,
                    velocity=start_velocity,
                    start_tick=start_tick,
                    duration_tick=absolute_tick - start_tick,
                    channel=channel,
                )
            )

    notes.sort(
        key=lambda n: (
            _as_int(getattr(n, "start_tick", 0), 0),
            _as_int(getattr(n, "channel", 0), 0),
            _as_int(getattr(n, "note_number", 0), 0),
        )
    )
    return notes, track_tempo, track_time_sig


def parse_midi(filepath: str) -> tuple[list[Note], dict]:
    """
    读取 MIDI 文件并输出所有音符及基础元数据。

    Returns:
        (notes, metadata)
    """

    midi_file = mido.MidiFile(filepath)
    all_notes: list[Note] = []
    tempo: int | None = None
    time_sig: tuple[int, int] | None = None

    for track in midi_file.tracks:
        track_notes, track_tempo, track_time_sig = _parse_track(track)
        all_notes.extend(track_notes)
        if tempo is None and track_tempo is not None:
            tempo = track_tempo
        if time_sig is None and track_time_sig is not None:
            time_sig = track_time_sig

    all_notes.sort(
        key=lambda n: (
            _as_int(getattr(n, "start_tick", 0), 0),
            _as_int(getattr(n, "channel", 0), 0),
            _as_int(getattr(n, "note_number", 0), 0),
        )
    )

    metadata = {
        "tempo": tempo if tempo is not None else DEFAULT_TEMPO,
        "time_sig": time_sig if time_sig is not None else DEFAULT_TIME_SIG,
        "ppq": _as_int(getattr(midi_file, "ticks_per_beat", 480), 480),
        "tracks": len(midi_file.tracks),
    }
    return all_notes, metadata


def extract_melody_track(filepath: str) -> list[Note]:
    """
    提取旋律轨道：多轨时选取非鼓轨中平均音高最高的一轨。
    """

    midi_file = mido.MidiFile(filepath)

    if len(midi_file.tracks) <= 1:
        notes, _ = parse_midi(filepath)
        return notes

    fallback_notes: list[Note] = []
    best_notes: list[Note] = []
    best_avg_pitch: float | None = None

    for track in midi_file.tracks:
        track_notes, _, _ = _parse_track(track)
        if track_notes and not fallback_notes:
            fallback_notes = track_notes

        melodic_notes = [n for n in track_notes if _as_int(getattr(n, "channel", 0), 0) != 9]
        if not melodic_notes:
            continue

        avg_pitch = sum(_as_int(getattr(n, "note_number", 60), 60) for n in melodic_notes) / len(melodic_notes)
        if best_avg_pitch is None or avg_pitch > best_avg_pitch:
            best_avg_pitch = avg_pitch
            best_notes = melodic_notes

    return best_notes if best_notes else fallback_notes
