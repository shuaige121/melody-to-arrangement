"""
LLM 决策层 — 只选策略，不输出音符。
LLM is a "style router", it picks which patterns to use.
"""

from __future__ import annotations

import json
import os
from typing import Any

from arranger.engine.tools import AVAILABLE_STRATEGIES
from arranger.models.arrangement import AnalysisResult, ArrangementStrategy
from arranger.patterns.drums import DRUM_PATTERNS

try:
    import anthropic

    HAS_ANTHROPIC = True
except ImportError:
    anthropic = None
    HAS_ANTHROPIC = False

DEFAULT_MODEL = "claude-3-5-haiku-latest"
ENERGY_LEVELS = {"low", "medium", "high"}


def _analysis_payload(analysis: AnalysisResult) -> dict[str, Any]:
    if hasattr(analysis, "model_dump"):
        return analysis.model_dump()
    if hasattr(analysis, "dict"):
        return analysis.dict()
    return {
        "key": getattr(analysis, "key", "C_major"),
        "tempo": getattr(analysis, "tempo", 120),
        "time_sig": getattr(analysis, "time_sig", (4, 4)),
        "total_bars": getattr(analysis, "total_bars", 4),
        "sections": getattr(analysis, "sections", []),
        "melody_range": getattr(analysis, "melody_range", (60, 72)),
        "melody_density": getattr(analysis, "melody_density", "medium"),
    }


def _section_count(analysis: AnalysisResult) -> int:
    sections = getattr(analysis, "sections", None)
    if isinstance(sections, list) and sections:
        return len(sections)
    return 4


def _default_energy_curve(count: int, mood: str) -> list[str]:
    mood_key = (mood or "").strip().lower()
    high_moods = {"happy", "energetic", "excited", "uplifting", "powerful"}
    low_moods = {"sad", "calm", "soft", "chill", "ambient"}

    if mood_key in high_moods:
        base = ["medium", "high", "high", "medium"]
    elif mood_key in low_moods:
        base = ["low", "low", "medium", "low"]
    else:
        base = ["low", "medium", "high", "medium"]

    return [base[i % len(base)] for i in range(max(1, count))]


def _extract_json_object(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None

    candidates: list[str] = [text]

    if "```" in text:
        parts = text.split("```")
        for part in parts:
            cleaned = part.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)

    start = text.find("{")
    if start != -1:
        depth = 0
        for idx in range(start, len(text)):
            char = text[idx]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    candidates.append(text[start : idx + 1])
                    break

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    return None


def _extract_response_text(response: Any) -> str:
    blocks = getattr(response, "content", []) or []
    parts: list[str] = []
    for block in blocks:
        block_text = getattr(block, "text", None)
        if block_text is None and isinstance(block, dict):
            block_text = block.get("text")
        if isinstance(block_text, str) and block_text.strip():
            parts.append(block_text.strip())
    return "\n".join(parts).strip()


def _sanitize_choice(value: Any, valid_choices: list[str], default: str) -> str:
    candidate = str(value or "").strip()
    if candidate in valid_choices:
        return candidate
    return default


def _sanitize_energy_curve(raw_value: Any, fallback: list[str], count: int) -> list[str]:
    if isinstance(raw_value, str):
        source = [piece.strip() for piece in raw_value.replace("|", ",").split(",")]
    elif isinstance(raw_value, list):
        source = [str(piece).strip() for piece in raw_value]
    else:
        source = []

    normalized = [level.lower() for level in source if level.lower() in ENERGY_LEVELS]
    if not normalized:
        normalized = list(fallback)

    target_count = max(1, count)
    if len(normalized) < target_count:
        normalized.extend([normalized[-1]] * (target_count - len(normalized)))
    return normalized[:target_count]


def _select_default_drum(style_key: str) -> str:
    drum_candidates = AVAILABLE_STRATEGIES["drum_styles"]
    if not drum_candidates:
        raise ValueError("AVAILABLE_STRATEGIES['drum_styles'] must not be empty")

    for candidate in drum_candidates:
        tags = DRUM_PATTERNS.get(candidate, {}).get("tags", {})
        genres = tags.get("genre", [])
        if style_key and style_key in genres:
            return candidate
    return drum_candidates[0]


def _coerce_strategy_payload(
    payload: dict[str, Any],
    fallback: ArrangementStrategy,
    style_key: str,
    analysis: AnalysisResult,
    mood: str,
) -> ArrangementStrategy:
    all_progressions = {
        progression
        for values in AVAILABLE_STRATEGIES["progression_styles"].values()
        for progression in values
    }
    fallback_curve = _default_energy_curve(_section_count(analysis), mood)

    progression_style = str(payload.get("progression_style", "")).strip()
    if progression_style not in all_progressions:
        progression_style = fallback.progression_style

    drum_style = _sanitize_choice(
        payload.get("drum_style"),
        AVAILABLE_STRATEGIES["drum_styles"],
        fallback.drum_style,
    )
    bass_style = _sanitize_choice(
        payload.get("bass_style"),
        AVAILABLE_STRATEGIES["bass_styles"],
        fallback.bass_style,
    )
    piano_style = _sanitize_choice(
        payload.get("piano_style"),
        AVAILABLE_STRATEGIES["piano_styles"],
        fallback.piano_style,
    )

    return ArrangementStrategy(
        progression_style=progression_style,
        drum_style=drum_style,
        bass_style=bass_style,
        piano_style=piano_style,
        energy_curve=_sanitize_energy_curve(
            payload.get("energy_curve"),
            fallback=fallback_curve,
            count=_section_count(analysis),
        ),
    )


def _call_llm_router(analysis: AnalysisResult, style: str, mood: str) -> dict[str, Any] | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or not HAS_ANTHROPIC:
        return None

    prompt = (
        f"Given this melody analysis: {_analysis_payload(analysis)}, target style: {style}, mood: {mood}.\n"
        f"Choose the best arrangement strategy from these options: {AVAILABLE_STRATEGIES}.\n"
        "Return JSON: {progression_style, drum_style, bass_style, piano_style, energy_curve}"
    )

    model_name = os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model_name,
        max_tokens=400,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_json_object(_extract_response_text(response))


def _fallback_strategy(analysis: AnalysisResult, style: str, mood: str) -> ArrangementStrategy:
    """
    Pure rule-based: pick default patterns based on style.
    This ensures the system works WITHOUT any API key.
    """

    style_key = (style or "").strip().lower()
    progression_choices = AVAILABLE_STRATEGIES["progression_styles"].get(
        style_key,
        AVAILABLE_STRATEGIES["progression_styles"]["pop"],
    )
    section_count = _section_count(analysis)

    return ArrangementStrategy(
        progression_style=progression_choices[0],
        drum_style=_select_default_drum(style_key),
        bass_style=AVAILABLE_STRATEGIES["bass_styles"][0],
        piano_style=AVAILABLE_STRATEGIES["piano_styles"][0],
        energy_curve=_default_energy_curve(section_count, mood),
    )


def get_strategy(analysis: AnalysisResult, style: str, mood: str) -> ArrangementStrategy:
    """
    Try Claude API strategy routing first; fallback to rule-based defaults on failure.
    """

    style_key = (style or "").strip().lower()
    fallback = _fallback_strategy(analysis=analysis, style=style, mood=mood)

    try:
        payload = _call_llm_router(analysis=analysis, style=style, mood=mood)
        if not payload:
            return fallback
        return _coerce_strategy_payload(
            payload=payload,
            fallback=fallback,
            style_key=style_key,
            analysis=analysis,
            mood=mood,
        )
    except Exception:
        return fallback


__all__ = ["get_strategy", "_fallback_strategy", "HAS_ANTHROPIC"]
