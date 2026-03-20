"""
LLM 可选策略定义 — LLM 只从这些选项中选择。
"""

from __future__ import annotations

from arranger.patterns.drums import DRUM_PATTERNS

AVAILABLE_STRATEGIES = {
    "progression_styles": {
        "pop": ["I-V-vi-IV", "vi-IV-I-V", "I-IV-V-I", "I-vi-IV-V"],
        "rock": ["I-IV-V-IV", "I-bVII-IV-I", "i-bVI-bVII-i"],
        "ballad": ["I-iii-IV-V", "vi-IV-I-V", "I-V-vi-iii-IV-I-IV-V"],
        "jazz": ["ii-V-I-I", "I-vi-ii-V", "iii-vi-ii-V"],
    },
    "drum_styles": list(DRUM_PATTERNS.keys()),  # from patterns.drums
    "bass_styles": [
        "root_note",
        "root_octave",
        "walking",
        "arpeggio",
        "syncopated",
        "pedal",
    ],
    "piano_styles": ["block_chord", "arpeggiated", "rhythmic_stab", "ballad_spread"],
}
