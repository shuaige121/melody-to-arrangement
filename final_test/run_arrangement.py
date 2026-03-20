from __future__ import annotations

import csv
from dataclasses import asdict
from importlib import import_module
import json
import math
from pathlib import Path
import shutil
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
INPUT_CSV = PROJECT_ROOT / "examples" / "c_major_hook.csv"
OUTPUT_ROOT = PROJECT_ROOT / "final_test"
PPQ = 480
TEMPO_BPM = 120
TIME_SIG = (4, 4)
TICKS_PER_BAR = PPQ * TIME_SIG[0] * 4 // TIME_SIG[1]
SECONDS_PER_BAR = (60 / TEMPO_BPM) * TIME_SIG[0] * (4 / TIME_SIG[1])

for import_root in (PROJECT_ROOT, SRC_ROOT):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

arrange_melody = import_module("arranger.engine.arrange").arrange_melody
build_midi = import_module("arranger.midi.builder").build_midi
_arrangement_models = import_module("arranger.models.arrangement")
Arrangement = _arrangement_models.Arrangement
Track = _arrangement_models.Track
Note = import_module("arranger.models.note").Note
_creativity = import_module("melody_architect.creativity")
CreativityLevel = _creativity.CreativityLevel
get_config = _creativity.get_config


ARRANGEMENT_PRESETS = (
    {
        "level": CreativityLevel.CONSERVATIVE,
        "style": "pop",
        "complexity": "basic",
        "arrangement_bars": 16,
    },
    {
        "level": CreativityLevel.BALANCED,
        "style": "pop",
        "complexity": "rich",
        "arrangement_bars": 32,
    },
    {
        "level": CreativityLevel.CREATIVE,
        "style": "jazz",
        "complexity": "rich",
        "arrangement_bars": 64,
    },
)


def _seconds_to_ticks(value: float) -> int:
    return int(round(float(value) * PPQ * TEMPO_BPM / 60))


def load_input_file(csv_path: Path) -> list[Note]:
    with csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        notes = [
            Note(
                note_number=int(row["pitch"]),
                start_tick=_seconds_to_ticks(row["start"]),
                duration_tick=max(
                    1,
                    _seconds_to_ticks(float(row["end"]) - float(row["start"])),
                ),
                velocity=int(row.get("velocity") or 90),
                channel=0,
            )
            for row in reader
        ]

    notes.sort(key=lambda note: (note.start_tick, note.note_number))
    return notes


def analyze_melody_data(
    data: list[Note], style: str, bars: int
) -> dict[str, int | str]:
    source_ticks = max(
        (note.start_tick + note.duration_tick for note in data),
        default=TICKS_PER_BAR,
    )
    return {
        "input_notes": len(data),
        "source_bars": max(1, math.ceil(source_ticks / TICKS_PER_BAR)),
        "preview_bars": max(1, int(bars)),
        "style": style,
    }


def _loop_melody_notes(
    notes: list[Note], source_bars: int, arrangement_bars: int
) -> list[Note]:
    source_span_ticks = max(1, source_bars) * TICKS_PER_BAR
    target_span_ticks = max(1, arrangement_bars) * TICKS_PER_BAR

    repeated: list[Note] = []
    loop_index = 0
    while loop_index * source_span_ticks < target_span_ticks:
        offset = loop_index * source_span_ticks
        for note in notes:
            start_tick = note.start_tick + offset
            if start_tick >= target_span_ticks:
                break

            duration_tick = min(note.duration_tick, target_span_ticks - start_tick)
            repeated.append(
                Note(
                    note_number=note.note_number,
                    velocity=note.velocity,
                    start_tick=start_tick,
                    duration_tick=max(1, duration_tick),
                    channel=note.channel,
                )
            )
        loop_index += 1

    return repeated


def create_logic_project_bundle(
    data: list[Note],
    report: dict[str, int | str],
    output_dir: Path,
    project_name: str,
    quantize_subdivisions: int,
    complexity: str,
    arrangement_bars: int,
    loop_melody: bool,
    style: str,
) -> dict[str, str]:
    del project_name, quantize_subdivisions
    output_dir.mkdir(parents=True, exist_ok=True)

    melody_notes = list(data)
    source_bars = int(report.get("source_bars", 1))
    if loop_melody:
        melody_notes = _loop_melody_notes(
            melody_notes,
            source_bars=source_bars,
            arrangement_bars=arrangement_bars,
        )

    source_midi = output_dir / "source_melody.mid"
    build_midi(
        Arrangement(
            tracks=[
                Track(name="Lead Melody", channel=0, program=80, notes=melody_notes)
            ],
            tempo=TEMPO_BPM,
            time_sig=TIME_SIG,
            ppq=PPQ,
            total_bars=max(1, arrangement_bars),
            metadata={"source_csv": str(INPUT_CSV)},
        ),
        str(source_midi),
    )

    arranged_midi = output_dir / "logic_arrangement.mid"
    # TODO: The legacy pipeline supported Logic bundle export plus a separate
    # complexity knob. The current arranger engine only exposes MIDI output, so
    # this compatibility path keeps the script working but ignores legacy
    # project-bundle metadata beyond the rendered MIDI file.
    arrange_melody(
        input_path=str(source_midi),
        output_path=str(arranged_midi),
        style=style,
        mood="neutral" if complexity == "basic" else "energetic",
    )
    return {"midi": str(arranged_midi)}


def run_one(
    level: CreativityLevel, style: str, complexity: str, arrangement_bars: int
) -> Path:
    level_name = level.value
    print(f"\n=== Running level: {level_name} ===")
    data = load_input_file(INPUT_CSV)
    report = analyze_melody_data(data, style=style, bars=8)

    bundle = create_logic_project_bundle(
        data=data,
        report=report,
        output_dir=OUTPUT_ROOT / level_name,
        project_name=f"{level_name.capitalize()} Arrangement",
        quantize_subdivisions=4,
        complexity=complexity,
        arrangement_bars=arrangement_bars,
        loop_melody=True,
        style=style,
    )

    source_midi = Path(bundle["midi"])
    target_midi = OUTPUT_ROOT / f"output_{level_name}.mid"
    shutil.copy2(source_midi, target_midi)

    config = get_config(level)
    print("Creativity config:")
    print(json.dumps(asdict(config), ensure_ascii=False, indent=2, default=str))
    print(f"Exported MIDI: {target_midi} ({target_midi.stat().st_size} bytes)")
    return target_midi


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_CSV}")

    produced = []
    for preset in ARRANGEMENT_PRESETS:
        produced.append(run_one(**preset))

    print("\n=== Final outputs ===")
    for path in produced:
        print(f"{path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
