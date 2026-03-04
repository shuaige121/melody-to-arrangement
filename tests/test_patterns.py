from arranger.models.note import Note
from arranger.patterns.bass import generate_bass_line
from arranger.patterns.chords import COMMON_PROGRESSIONS, resolve_progression
from arranger.patterns.drums import DRUM_PATTERNS, drum_pattern_to_notes, get_drum_pattern
from arranger.patterns.piano import generate_piano_comp


def test_common_progressions_contains_required_styles():
    assert {"pop", "rock", "ballad", "jazz"}.issubset(COMMON_PROGRESSIONS.keys())


def test_resolve_progression_c_major_i_v_vi_iv():
    chords = resolve_progression(["I", "V", "vi", "IV"], "C_major")
    assert chords == [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]]


def test_drum_patterns_has_minimum_entries():
    assert len(DRUM_PATTERNS) >= 5


def test_drum_pattern_to_notes_returns_channel_9_notes():
    pattern = get_drum_pattern("4_4_basic")
    notes = drum_pattern_to_notes(pattern, bar_start_tick=0, ppq=480)
    assert notes
    assert all(isinstance(note, Note) for note in notes)
    assert all(note.channel == 9 for note in notes)


def test_generate_bass_line_stays_in_bass_range():
    chords = resolve_progression(["I", "V", "vi", "IV"], "C_major")
    notes = generate_bass_line(chords, style="root_octave", bars=4, ppq=480)
    assert notes
    assert all(28 <= note.note_number <= 55 for note in notes)


def test_generate_piano_comp_stays_in_piano_range():
    chords = resolve_progression(["I", "V", "vi", "IV"], "C_major")
    notes = generate_piano_comp(chords, style="block_chord", bars=4, ppq=480)
    assert notes
    assert all(48 <= note.note_number <= 84 for note in notes)
