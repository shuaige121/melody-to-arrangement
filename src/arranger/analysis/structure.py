"""
结构分析 / Structure analysis.

按 8 小节分段并估计每段统计特征，附带强拍识别。
Split melody into 8-bar sections, compute per-section statistics,
and detect strong-beat notes.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from arranger.models.note import Note


def _safe_attr(note: Note, name: str, default: Any = None) -> Any:
    """安全读取 Note 字段 / Safely read note attributes."""
    return getattr(note, name, default)


def _bar_ticks(time_sig: tuple[int, int], ppq: int) -> int:
    """按拍号和 PPQ 计算每小节 tick。Compute ticks per bar."""
    numerator, denominator = time_sig
    ticks = int(round(ppq * numerator * (4.0 / denominator)))
    return max(ticks, 1)


def _density_label(note_density: float) -> str:
    """密度标签 / Density label."""
    if note_density < 4:
        return "sparse"
    if note_density <= 8:
        return "medium"
    return "dense"


def _label_sections(section_stats: list[dict[str, Any]]) -> list[str]:
    """
    基于能量和密度做段落命名。
    Label sections heuristically from energy and density.
    """
    if not section_stats:
        return []

    energies = np.array([float(s["energy"]) for s in section_stats], dtype=float)
    densities = np.array([float(s["note_density"]) for s in section_stats], dtype=float)
    mean_energy = float(np.mean(energies)) if energies.size else 0.0
    energy_threshold = max(mean_energy * 1.1, float(np.quantile(energies, 0.7)))
    density_threshold = float(np.median(densities)) if densities.size else 0.0

    labels: list[str] = ["verse"] * len(section_stats)
    first_density = float(section_stats[0]["note_density"])
    labels[0] = "intro" if first_density < 4 else "verse"

    chorus_indices: list[int] = []
    for idx, stat in enumerate(section_stats):
        if idx == 0:
            continue
        energy = float(stat["energy"])
        density = float(stat["note_density"])
        if energy >= energy_threshold and density >= density_threshold:
            labels[idx] = "chorus"
            chorus_indices.append(idx)

    if chorus_indices:
        first_chorus = chorus_indices[0]
        chorus_energy = float(section_stats[first_chorus]["energy"])
        for idx in range(first_chorus + 1, len(section_stats) - 1):
            if labels[idx] == "chorus":
                continue
            energy = float(section_stats[idx]["energy"])
            if energy <= chorus_energy * 0.85:
                prev_is_chorus = labels[idx - 1] == "chorus"
                labels[idx] = "bridge" if prev_is_chorus else "verse"

    if len(labels) > 1:
        last_idx = len(labels) - 1
        prev_energy = float(section_stats[last_idx - 1]["energy"])
        last_energy = float(section_stats[last_idx]["energy"])
        if last_energy < prev_energy * 0.85 or float(section_stats[last_idx]["note_density"]) < 4:
            labels[last_idx] = "outro"

    return labels


def analyze_structure(
    notes: list[Note],
    tempo: int,
    time_sig: tuple[int, int],
    ppq: int = 480,
) -> list[dict[str, Any]]:
    """
    结构切分（默认每段 8 小节）并计算段落统计。
    Split melody into default 8-bar sections and compute section features.

    Args:
        notes: 主旋律音符列表 / melody notes.
        tempo: 曲速 BPM / tempo in BPM.
        time_sig: 拍号 (numerator, denominator) / time signature tuple.
        ppq: MIDI pulses per quarter note.

    Returns:
        list[dict]: 每段的统计与标签 / per-section statistics and labels.
    """
    if not notes:
        return []

    sorted_notes = sorted(notes, key=lambda n: int(_safe_attr(n, "start_tick", 0)))
    bar_ticks = _bar_ticks(time_sig, ppq)
    section_bars = 8
    section_ticks = bar_ticks * section_bars

    max_end_tick = max(
        int(_safe_attr(n, "start_tick", 0)) + max(int(_safe_attr(n, "duration_tick", 0)), 0)
        for n in sorted_notes
    )
    if max_end_tick <= 0:
        max_end_tick = max(int(_safe_attr(n, "start_tick", 0)) for n in sorted_notes) + 1

    num_sections = max(int(np.ceil(max_end_tick / section_ticks)), 1)
    sections: list[dict[str, Any]] = []

    for section_idx in range(num_sections):
        start_tick = section_idx * section_ticks
        end_tick = min((section_idx + 1) * section_ticks, max_end_tick)
        in_section = [
            n
            for n in sorted_notes
            if start_tick <= int(_safe_attr(n, "start_tick", 0)) < end_tick
        ]

        if in_section:
            pitches = np.array([int(_safe_attr(n, "note_number", 60)) for n in in_section], dtype=float)
            velocities = np.array([int(_safe_attr(n, "velocity", 64)) for n in in_section], dtype=float)
            avg_pitch = float(np.mean(pitches))
            energy = float(np.mean(velocities))
        else:
            avg_pitch = 0.0
            energy = 0.0

        bars_in_section = max((end_tick - start_tick) / bar_ticks, 1.0)
        note_density = float(len(in_section) / bars_in_section)
        sections.append(
            {
                "index": section_idx,
                "start_tick": int(start_tick),
                "end_tick": int(end_tick),
                "start_bar": int(start_tick // bar_ticks),
                "end_bar": int(np.ceil(end_tick / bar_ticks)),
                "tempo": int(tempo),
                "time_sig": f"{time_sig[0]}/{time_sig[1]}",
                "avg_pitch": round(avg_pitch, 3),
                "note_density": round(note_density, 3),
                "density_label": _density_label(note_density),
                "energy": round(energy, 3),
            }
        )

    labels = _label_sections(sections)
    for idx, label in enumerate(labels):
        sections[idx]["label"] = label
        sections[idx]["name"] = label

    return sections


def identify_strong_beats(notes: list[Note], ppq: int = 480, beats_per_bar: int = 4) -> list[int]:
    """
    识别强拍（4/4 下第 1、3 拍）上的音高。
    Return note numbers that land on strong beats (beat 1 or 3 in 4/4).

    强拍判定近似为 start_tick 对小节取模后接近 0 或 2*ppq。
    Strong beat is approximated by bar-relative tick near 0 or 2*ppq.
    """
    if not notes:
        return []

    bar_ticks = max(ppq * beats_per_bar, 1)
    beat1 = 0
    beat3 = ppq * 2
    tolerance = max(ppq // 8, 1)

    strong_notes: list[int] = []
    for note in notes:
        start_tick = int(_safe_attr(note, "start_tick", 0))
        phase = start_tick % bar_ticks
        on_beat1 = min(abs(phase - beat1), abs(phase - bar_ticks)) <= tolerance
        on_beat3 = abs(phase - beat3) <= tolerance
        if on_beat1 or on_beat3:
            strong_notes.append(int(_safe_attr(note, "note_number", 60)))

    return strong_notes
