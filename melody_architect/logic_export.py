from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from .midi_writer import MidiTrack, write_multi_track_midi
from .models import Chord, MelodyData, NoteEvent
from .reporting import to_markdown
from .theory import note_name_to_pc, resolve_roman_to_chord


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip()).strip("-").lower()
    return slug or "logic-project"


def _quantize_time(seconds: float, beat_seconds: float, subdivisions_per_beat: int = 4) -> float:
    if subdivisions_per_beat <= 0:
        return max(0.0, seconds)
    step = beat_seconds / subdivisions_per_beat
    return round(max(0.0, seconds) / step) * step


def _quantize_notes(notes: list[NoteEvent], tempo_bpm: float, subdivisions_per_beat: int = 4) -> list[NoteEvent]:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    quantized: list[NoteEvent] = []
    for note in notes:
        start = _quantize_time(note.start, beat_seconds, subdivisions_per_beat)
        end = _quantize_time(note.end, beat_seconds, subdivisions_per_beat)
        if end <= start:
            end = start + beat_seconds / subdivisions_per_beat
        quantized.append(
            NoteEvent(
                pitch=note.pitch,
                start=start,
                end=end,
                velocity=note.velocity,
                track=note.track,
            )
        )
    return quantized


def _bar_seconds(tempo_bpm: float, beats_per_bar: int) -> float:
    return (60.0 / max(1e-6, tempo_bpm)) * beats_per_bar


def _infer_source_span_seconds(notes: list[NoteEvent], tempo_bpm: float, beats_per_bar: int) -> float:
    if not notes:
        return _bar_seconds(tempo_bpm, beats_per_bar)
    max_end = max(note.end for note in notes)
    bar_sec = _bar_seconds(tempo_bpm, beats_per_bar)
    bars = max(1, int(math.ceil(max_end / bar_sec)))
    return bars * bar_sec


def _loop_melody_to_bars(
    notes: list[NoteEvent],
    tempo_bpm: float,
    beats_per_bar: int,
    target_bars: int,
    loop_melody: bool = True,
) -> list[NoteEvent]:
    if not notes or target_bars <= 0:
        return notes

    bar_sec = _bar_seconds(tempo_bpm, beats_per_bar)
    target_sec = target_bars * bar_sec
    source_span = _infer_source_span_seconds(notes, tempo_bpm, beats_per_bar)
    if source_span <= 0:
        return notes

    if not loop_melody:
        clipped: list[NoteEvent] = []
        for note in notes:
            if note.start >= target_sec:
                continue
            clipped.append(
                NoteEvent(
                    pitch=note.pitch,
                    start=note.start,
                    end=min(note.end, target_sec),
                    velocity=note.velocity,
                    track=note.track,
                )
            )
        return clipped

    repeats = max(1, int(math.ceil(target_sec / source_span)))
    looped: list[NoteEvent] = []
    for idx in range(repeats):
        shift = idx * source_span
        for note in notes:
            start = note.start + shift
            end = note.end + shift
            if start >= target_sec:
                continue
            if end <= 0:
                continue
            looped.append(
                NoteEvent(
                    pitch=note.pitch,
                    start=start,
                    end=min(end, target_sec),
                    velocity=note.velocity,
                    track=note.track,
                )
            )
    return sorted(looped, key=lambda item: (item.start, item.pitch, item.end))


def _lead_track(notes: list[NoteEvent], style: str) -> MidiTrack:
    program = {"pop": 80, "modal": 28, "jazz": 65}.get(style, 80)
    return MidiTrack(name="Lead Melody", channel=0, program=program, notes=tuple(notes))


def _bass_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int, style: str) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    base = 36  # C2
    for bar_idx, chord in enumerate(chords):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        root_pitch = base + chord.root_pc
        for beat in range(beats_per_bar):
            start = bar_start + beat * beat_seconds
            duration = beat_seconds * (0.9 if style == "modal" else 0.8)
            pitch = root_pitch
            if style == "jazz" and beat in (1, 3):
                pitch = root_pitch + 7
            elif style == "pop" and beat == beats_per_bar - 1:
                pitch = root_pitch + 2
            notes.append(
                NoteEvent(
                    pitch=max(28, min(60, pitch)),
                    start=start,
                    end=start + duration,
                    velocity=82,
                    track="bass",
                )
            )
    return MidiTrack(name="Bass", channel=1, program=33, notes=tuple(notes))


def _pad_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int, style: str) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    for bar_idx, chord in enumerate(chords):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        bar_end = bar_start + beats_per_bar * beat_seconds
        tones = list(chord.tones[:3])
        base = 60  # C4
        for offset, tone in enumerate(tones):
            pitch = base + tone + (12 if offset == 2 and style == "jazz" else 0)
            notes.append(
                NoteEvent(
                    pitch=max(48, min(84, pitch)),
                    start=bar_start,
                    end=bar_end,
                    velocity=68 if style == "jazz" else 72,
                    track="harmony",
                )
            )
    program = {"pop": 0, "modal": 4, "jazz": 0}.get(style, 0)
    return MidiTrack(name="Harmony", channel=2, program=program, notes=tuple(notes))


def _drum_track(chord_count: int, tempo_bpm: float, beats_per_bar: int, style: str) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    total_bars = max(1, chord_count)
    for bar_idx in range(total_bars):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        for beat in range(beats_per_bar):
            start = bar_start + beat * beat_seconds
            kick = beat in (0, 2) if beats_per_bar >= 4 else beat == 0
            snare = beat in (1, 3) if beats_per_bar >= 4 else beat == 1
            hat = True
            if kick:
                notes.append(NoteEvent(pitch=36, start=start, end=start + 0.08, velocity=95, track="drums"))
            if snare:
                notes.append(NoteEvent(pitch=38, start=start, end=start + 0.08, velocity=90, track="drums"))
            if hat:
                notes.append(NoteEvent(pitch=42, start=start, end=start + 0.05, velocity=64, track="drums"))
            if style == "modal":
                off = start + beat_seconds * 0.5
                notes.append(NoteEvent(pitch=42, start=off, end=off + 0.05, velocity=58, track="drums"))
    return MidiTrack(name="Drums", channel=9, program=0, notes=tuple(notes))


def _sub_bass_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    for bar_idx, chord in enumerate(chords):
        start = bar_idx * beats_per_bar * beat_seconds
        root = 24 + chord.root_pc  # C1
        notes.append(
            NoteEvent(
                pitch=max(24, min(48, root)),
                start=start,
                end=start + beat_seconds * (beats_per_bar * 0.95),
                velocity=78,
                track="sub_bass",
            )
        )
    return MidiTrack(name="Sub Bass", channel=6, program=39, notes=tuple(notes))


def _arp_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int, style: str) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    step = beat_seconds * 0.5
    notes: list[NoteEvent] = []
    for bar_idx, chord in enumerate(chords):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        tones = list(chord.tones)
        if style == "jazz":
            tones = tones + [((chord.root_pc + 14) % 12)]
        for idx in range(beats_per_bar * 2):
            tone = tones[idx % len(tones)]
            start = bar_start + idx * step
            pitch = 60 + tone + (12 if idx % 4 in (2, 3) else 0)
            notes.append(
                NoteEvent(
                    pitch=max(52, min(88, pitch)),
                    start=start,
                    end=start + step * 0.8,
                    velocity=64 if idx % 2 else 70,
                    track="arp",
                )
            )
    program = 0 if style != "modal" else 4
    return MidiTrack(name="Arp Keys", channel=3, program=program, notes=tuple(notes))


def _strings_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    for bar_idx, chord in enumerate(chords):
        start = bar_idx * beats_per_bar * beat_seconds
        end = start + beats_per_bar * beat_seconds
        tones = chord.tones[:3]
        base = 55
        for idx, tone in enumerate(tones):
            pitch = base + tone + (12 * (idx // 2))
            notes.append(
                NoteEvent(
                    pitch=max(48, min(90, pitch)),
                    start=start,
                    end=end,
                    velocity=60,
                    track="strings",
                )
            )
    return MidiTrack(name="Strings", channel=4, program=48, notes=tuple(notes))


def _counter_melody_track(lead_notes: list[NoteEvent], tempo_bpm: float, beats_per_bar: int) -> MidiTrack:
    if not lead_notes:
        return MidiTrack(name="Counter Melody", channel=5, program=73, notes=tuple())
    bar_sec = _bar_seconds(tempo_bpm, beats_per_bar)
    notes: list[NoteEvent] = []
    for note in lead_notes:
        bar_idx = int(note.start / bar_sec)
        if bar_idx % 4 in (2, 3):
            pitch = note.pitch - 5 if note.pitch >= 67 else note.pitch + 7
            notes.append(
                NoteEvent(
                    pitch=max(48, min(90, pitch)),
                    start=note.start + 0.12,
                    end=note.end + 0.08,
                    velocity=max(40, min(100, note.velocity - 18)),
                    track="counter",
                )
            )
    return MidiTrack(name="Counter Melody", channel=5, program=73, notes=tuple(notes))


def _rhythm_guitar_track(chords: tuple[Chord, ...], tempo_bpm: float, beats_per_bar: int) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    for bar_idx, chord in enumerate(chords):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        tones = chord.tones[:3]
        for beat in range(beats_per_bar):
            if beat % 2 == 0:
                continue
            start = bar_start + beat * beat_seconds + beat_seconds * 0.05
            for tone in tones:
                notes.append(
                    NoteEvent(
                        pitch=max(50, min(86, 64 + tone)),
                        start=start,
                        end=start + beat_seconds * 0.45,
                        velocity=62,
                        track="guitar",
                    )
                )
    return MidiTrack(name="Rhythm Guitar", channel=7, program=27, notes=tuple(notes))


def _percussion_track(chord_count: int, tempo_bpm: float, beats_per_bar: int) -> MidiTrack:
    beat_seconds = 60.0 / max(1e-6, tempo_bpm)
    notes: list[NoteEvent] = []
    for bar_idx in range(max(1, chord_count)):
        bar_start = bar_idx * beats_per_bar * beat_seconds
        for idx in range(beats_per_bar * 2):
            start = bar_start + idx * beat_seconds * 0.5
            notes.append(
                NoteEvent(
                    pitch=46 if idx % 2 else 42,
                    start=start,
                    end=start + 0.04,
                    velocity=54 if idx % 2 else 60,
                    track="perc",
                )
            )
    return MidiTrack(name="Percussion", channel=9, program=0, notes=tuple(notes))


def _resolve_selected_chords(report: dict[str, Any]) -> tuple[Chord, ...]:
    selected = report["harmony"]["selected_candidate"]
    tonic_name = report["key_estimate"]["tonic"]
    mode = selected.get("mode") or report["key_estimate"]["mode"]
    tonic_pc = note_name_to_pc(tonic_name)
    romans = selected["romans"]
    return tuple(resolve_roman_to_chord(token, tonic_pc=tonic_pc, mode=mode) for token in romans)


def _write_mac_scripts(bundle_dir: Path, midi_path: Path, project_name: str) -> None:
    open_script = bundle_dir / "open_in_logic.command"
    applescript_path = bundle_dir / "create_logic_project.applescript"
    final_logicx = (bundle_dir / f"{_slugify(project_name)}.logicx").resolve()

    shell_body = f"""#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIDI_FILE="$SCRIPT_DIR/{midi_path.name}"

if ! command -v osascript >/dev/null 2>&1; then
  echo "osascript not found. Please run this on macOS."
  exit 1
fi

echo "Opening Logic Pro and importing MIDI..."
osascript "$SCRIPT_DIR/{applescript_path.name}" "$MIDI_FILE" "{final_logicx.as_posix()}"
echo "Done. If Logic prompts for save location, choose: {final_logicx.as_posix()}"
"""
    open_script.write_text(shell_body, encoding="utf-8")
    open_script.chmod(0o755)

    applescript_body = """on run argv
  set midiPath to item 1 of argv
  set targetProjectPath to item 2 of argv
  tell application "Logic Pro"
    activate
    open POSIX file midiPath
  end tell
  delay 3
  display dialog "MIDI imported. Save project as: " & targetProjectPath buttons {"OK"} default button "OK"
end run
"""
    applescript_path.write_text(applescript_body, encoding="utf-8")


def create_logic_project_bundle(
    data: MelodyData,
    report: dict[str, Any],
    output_dir: str | Path,
    project_name: str,
    quantize_subdivisions: int = 4,
    complexity: str = "basic",
    arrangement_bars: int | None = None,
    loop_melody: bool = True,
) -> dict[str, str]:
    style = report["harmony"]["style"]
    if complexity not in {"basic", "rich"}:
        raise ValueError("complexity must be one of: basic, rich")

    base_chords = _resolve_selected_chords(report)
    target_bars = arrangement_bars if arrangement_bars is not None else len(base_chords)
    target_bars = max(1, target_bars)
    chords = tuple(base_chords[idx % len(base_chords)] for idx in range(target_bars))

    notes = _quantize_notes(data.sorted_notes(), tempo_bpm=data.tempo_bpm, subdivisions_per_beat=quantize_subdivisions)
    notes = _loop_melody_to_bars(
        notes,
        tempo_bpm=data.tempo_bpm,
        beats_per_bar=data.beats_per_bar,
        target_bars=target_bars,
        loop_melody=loop_melody,
    )

    bundle_dir = Path(output_dir) / _slugify(project_name)
    bundle_dir.mkdir(parents=True, exist_ok=True)

    midi_path = bundle_dir / "logic_arrangement.mid"
    tracks: list[MidiTrack] = [
        _lead_track(notes, style=style),
        _bass_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar, style=style),
        _pad_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar, style=style),
        _drum_track(len(chords), tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar, style=style),
    ]
    if complexity == "rich":
        tracks.extend(
            [
                _sub_bass_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar),
                _arp_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar, style=style),
                _strings_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar),
                _counter_melody_track(notes, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar),
                _rhythm_guitar_track(chords, tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar),
                _percussion_track(len(chords), tempo_bpm=data.tempo_bpm, beats_per_bar=data.beats_per_bar),
            ]
        )
    write_multi_track_midi(midi_path, tracks, tempo_bpm=data.tempo_bpm)

    report_json_path = bundle_dir / "analysis_report.json"
    report_md_path = bundle_dir / "analysis_report.md"
    report_json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    report_md_path.write_text(to_markdown(report), encoding="utf-8")

    track_map_path = bundle_dir / "logic_track_map.json"
    track_map = {
        "project_name": project_name,
        "tempo_bpm": report["input"]["tempo_bpm"],
        "meter": f"{report['input']['beats_per_bar']}/{report['input']['beat_unit']}",
        "arrangement_bars": target_bars,
        "complexity": complexity,
        "tracks": [],
    }
    hints = {
        "Lead Melody": "Lead > Synth Lead",
        "Bass": "Bass > Fingerstyle Bass",
        "Harmony": "Keys > Studio Piano / Electric Piano",
        "Drums": "Drum Kit > Producer Kit",
        "Sub Bass": "Bass > Synth Bass",
        "Arp Keys": "Keys > Bright Piano / EP",
        "Strings": "Orchestral > Studio Strings",
        "Counter Melody": "Lead > Flute / Solo Synth",
        "Rhythm Guitar": "Guitar > Clean Electric",
        "Percussion": "Drum Kit > Percussion",
    }
    for track in tracks:
        track_map["tracks"].append({"name": track.name, "logic_instrument_hint": hints.get(track.name, "Custom")})
    track_map_path.write_text(json.dumps(track_map, ensure_ascii=False, indent=2), encoding="utf-8")

    _write_mac_scripts(bundle_dir, midi_path, project_name)

    readme_path = bundle_dir / "README_LOGIC_IMPORT.md"
    readme_path.write_text(
        "\n".join(
            [
                f"# {project_name} Logic Import Kit",
                "",
                "1. 在 macOS 上双击 `open_in_logic.command`。",
                "2. Logic Pro 会自动打开并导入 `logic_arrangement.mid`。",
                "3. 导入后执行保存，推荐保存为同目录下的 `.logicx` 工程。",
                "4. 根据 `logic_track_map.json` 为每个轨道选择音色。",
            ]
        ),
        encoding="utf-8",
    )

    return {
        "bundle_dir": str(bundle_dir),
        "midi": str(midi_path),
        "report_json": str(report_json_path),
        "report_md": str(report_md_path),
        "track_map": str(track_map_path),
        "logic_launcher": str(bundle_dir / "open_in_logic.command"),
    }
