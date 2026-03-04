"""节奏栅栏 — 确保音符对齐节奏网格"""

from __future__ import annotations

from arranger.models.note import Note


def check_rhythm(note: Note, grid: int) -> bool:
    if grid <= 0:
        raise ValueError(f"grid must be > 0, got {grid}")
    return note.start_tick % grid == 0


def _nearest_grid(value: int, grid: int) -> int:
    lower = (value // grid) * grid
    upper = lower + grid
    if value - lower <= upper - value:
        return lower
    return upper


def fix_rhythm(note: Note, grid: int) -> Note:
    if grid <= 0:
        raise ValueError(f"grid must be > 0, got {grid}")

    fixed_start = _nearest_grid(note.start_tick, grid)
    return note.model_copy(update={"start_tick": fixed_start})


def quantize_duration(note: Note, grid: int) -> Note:
    if grid <= 0:
        raise ValueError(f"grid must be > 0, got {grid}")

    fixed_duration = _nearest_grid(note.duration_tick, grid)
    fixed_duration = max(grid, fixed_duration)
    return note.model_copy(update={"duration_tick": fixed_duration})
