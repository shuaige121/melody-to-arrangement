import pytest
from arranger.models.note import Note


@pytest.fixture
def c_major_melody():
    """Simple C major scale melody: C D E F G A B C"""
    return [
        Note(
            note_number=60 + i,
            velocity=80,
            start_tick=i * 480,
            duration_tick=480,
            channel=0,
        )
        for i in [0, 2, 4, 5, 7, 9, 11, 12]
    ]


@pytest.fixture
def simple_melody():
    """4-bar melody in C major"""
    notes = []
    pitches = [60, 64, 67, 65, 62, 60, 64, 67, 72, 71, 67, 64, 60, 62, 64, 60]
    for i, p in enumerate(pitches):
        notes.append(
            Note(
                note_number=p,
                velocity=80,
                start_tick=i * 480,
                duration_tick=480,
                channel=0,
            )
        )
    return notes
