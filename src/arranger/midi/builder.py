"""
MIDI 构建器 — 从 Arrangement 对象生成标准 .mid 文件。
"""

from __future__ import annotations

from pathlib import Path

import mido

from arranger.models.arrangement import Arrangement, Track
from arranger.models.note import Note


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def _sort_note_key(note: Note) -> tuple[int, int, int]:
    return (
        _as_int(getattr(note, "start_tick", 0), 0),
        _as_int(getattr(note, "channel", 0), 0),
        _as_int(getattr(note, "note_number", 0), 0),
    )


def notes_to_track(notes: list[Note], channel: int, program: int, track_name: str) -> mido.MidiTrack:
    """
    将 Note 列表转换为 MIDI 轨道消息，输入为 absolute tick，输出为 delta tick。
    """

    track = mido.MidiTrack()
    midi_channel = _clamp(_as_int(channel, 0), 0, 15)
    midi_program = _clamp(_as_int(program, 0), 0, 127)

    track.append(mido.MetaMessage("track_name", name=str(track_name), time=0))
    track.append(mido.Message("program_change", program=midi_program, channel=midi_channel, time=0))

    events: list[tuple[int, int, int, mido.Message]] = []
    for note in notes or []:
        start_tick = max(0, _as_int(getattr(note, "start_tick", 0), 0))
        duration_tick = max(0, _as_int(getattr(note, "duration_tick", 0), 0))
        end_tick = start_tick + duration_tick

        note_number = _clamp(_as_int(getattr(note, "note_number", 60), 60), 0, 127)
        velocity = _clamp(_as_int(getattr(note, "velocity", 80), 80), 0, 127)

        note_on = mido.Message(
            "note_on",
            note=note_number,
            velocity=velocity,
            channel=midi_channel,
            time=0,
        )
        note_off = mido.Message(
            "note_off",
            note=note_number,
            velocity=0,
            channel=midi_channel,
            time=0,
        )

        on_priority = 1
        off_priority = 2 if end_tick == start_tick else 0
        events.append((start_tick, on_priority, note_number, note_on))
        events.append((end_tick, off_priority, note_number, note_off))

    events.sort(key=lambda e: (e[0], e[1], e[2]))

    prev_tick = 0
    for tick, _, _, message in events:
        message.time = max(0, tick - prev_tick)
        track.append(message)
        prev_tick = tick

    track.append(mido.MetaMessage("end_of_track", time=0))
    return track


def build_midi(arrangement: Arrangement, output_path: str) -> str:
    """
    从 Arrangement 构建 Format 1 MIDI 文件。
    """

    ppq = max(1, _as_int(getattr(arrangement, "ppq", 480), 480))
    midi_file = mido.MidiFile(type=1, ticks_per_beat=ppq)

    tempo_track = mido.MidiTrack()
    midi_file.tracks.append(tempo_track)
    tempo_track.append(mido.MetaMessage("track_name", name="tempo", time=0))

    tempo_bpm = float(getattr(arrangement, "tempo", 120) or 120)
    tempo_track.append(mido.MetaMessage("set_tempo", tempo=int(mido.bpm2tempo(tempo_bpm)), time=0))

    time_sig = getattr(arrangement, "time_sig", (4, 4)) or (4, 4)
    numerator = max(1, _as_int(time_sig[0] if len(time_sig) > 0 else 4, 4))
    denominator = max(1, _as_int(time_sig[1] if len(time_sig) > 1 else 4, 4))
    tempo_track.append(
        mido.MetaMessage("time_signature", numerator=numerator, denominator=denominator, clocks_per_click=24, time=0)
    )

    key_sig = getattr(arrangement, "key_sig", None) or getattr(arrangement, "key_signature", None) or "C"
    try:
        tempo_track.append(mido.MetaMessage("key_signature", key=str(key_sig), time=0))
    except (TypeError, ValueError):
        tempo_track.append(mido.MetaMessage("key_signature", key="C", time=0))
    tempo_track.append(mido.MetaMessage("end_of_track", time=0))

    tracks: list[Track] = list(getattr(arrangement, "tracks", []) or [])
    for index, track_model in enumerate(tracks):
        track_notes = list(getattr(track_model, "notes", []) or [])
        track_notes.sort(key=_sort_note_key)
        track_channel = _as_int(getattr(track_model, "channel", index % 16), index % 16)
        track_program = _as_int(getattr(track_model, "program", 0), 0)
        track_name = str(getattr(track_model, "name", f"track_{index + 1}"))

        midi_track = notes_to_track(
            notes=track_notes,
            channel=track_channel,
            program=track_program,
            track_name=track_name,
        )
        midi_file.tracks.append(midi_track)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    midi_file.save(str(output))
    return str(output)


if __name__ == "__main__":
    from arranger.models.note import Note
    from arranger.models.arrangement import Arrangement, Track

    notes = [Note(note_number=60 + i, velocity=80, start_tick=i * 480, duration_tick=480, channel=0) for i in range(4)]
    arr = Arrangement(
        tracks=[Track(name="piano", channel=0, program=0, notes=notes)],
        tempo=120,
        time_sig=(4, 4),
        ppq=480,
        total_bars=1,
    )
    build_midi(arr, "/tmp/test_output.mid")
    print("OK: wrote /tmp/test_output.mid")
