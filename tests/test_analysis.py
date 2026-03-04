from arranger.analysis.melody import analyze_melody
from arranger.analysis.structure import analyze_structure
from arranger.models.arrangement import AnalysisResult
from arranger.models.note import Note


def test_analyze_melody_returns_analysis_result(simple_melody):
    result = analyze_melody(simple_melody)
    assert isinstance(result, AnalysisResult)


def test_analyze_melody_detects_c_major_key(c_major_melody):
    result = analyze_melody(c_major_melody)
    assert result.key == "C_major"


def test_analyze_melody_density_classification_dense():
    notes = [
        Note(note_number=60 + (i % 5), velocity=80, start_tick=i * 120, duration_tick=120, channel=0)
        for i in range(16)
    ]
    result = analyze_melody(notes)
    assert result.melody_density == "dense"


def test_analyze_structure_returns_sections_list(simple_melody):
    sections = analyze_structure(simple_melody, tempo=120, time_sig=(4, 4), ppq=480)
    assert isinstance(sections, list)
    assert len(sections) >= 1
    assert "start_tick" in sections[0]
    assert "end_tick" in sections[0]
    assert "name" in sections[0]


def test_analysis_handles_empty_notes_gracefully():
    melody_result = analyze_melody([])
    structure_result = analyze_structure([], tempo=120, time_sig=(4, 4), ppq=480)

    assert melody_result.key == "C_major"
    assert melody_result.sections == []
    assert melody_result.melody_density == "sparse"
    assert melody_result.total_bars == 1
    assert structure_result == []
