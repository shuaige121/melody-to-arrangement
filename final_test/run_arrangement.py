from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
import json
import shutil
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = PROJECT_ROOT / "examples" / "c_major_hook.csv"
OUTPUT_ROOT = PROJECT_ROOT / "final_test"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from melody_architect.creativity import CreativityLevel, get_config
from melody_architect.logic_export import create_logic_project_bundle
from melody_architect.pipeline import analyze_melody_data, load_input_file


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


def run_one(level: CreativityLevel, style: str, complexity: str, arrangement_bars: int) -> Path:
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
