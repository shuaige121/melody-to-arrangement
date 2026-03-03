import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { NoteEvent } from '../types/music.ts';
import './PianoRoll.css';

interface PianoRollProps {
  notes: NoteEvent[];
  onNotesChange: (notes: NoteEvent[]) => void;
  bars: number;
  beatsPerBar: number;
  tempoBpm: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6
const CELL_WIDTH = 48;
const CELL_HEIGHT = 20;

function pitchToName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const note = NOTE_NAMES[pitch % 12];
  return `${note}${octave}`;
}

function isBlackKey(pitch: number): boolean {
  const pc = pitch % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

export default function PianoRoll({ notes, onNotesChange, bars, beatsPerBar, tempoBpm }: PianoRollProps) {
  const [dragStart, setDragStart] = useState<{ pitch: number; beat: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / tempoBpm;

  // Build pitch rows top-down (high to low)
  const pitchRows = useMemo(() => {
    const rows: number[] = [];
    for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
      rows.push(p);
    }
    return rows;
  }, []);

  // Precompute a Set of active "pitch:beat" keys for O(1) lookup per cell
  const activeCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const n of notes) {
      const startBeat = Math.floor(n.start / secondsPerBeat);
      const endBeat = Math.ceil((n.start + n.duration) / secondsPerBeat);
      for (let b = startBeat; b < endBeat; b++) {
        keys.add(`${n.pitch}:${b}`);
      }
    }
    return keys;
  }, [notes, secondsPerBeat]);

  const findNoteAt = useCallback((pitch: number, beat: number): NoteEvent | undefined => {
    const time = beat * secondsPerBeat;
    return notes.find(
      (n) => n.pitch === pitch && time >= n.start && time < n.start + n.duration
    );
  }, [notes, secondsPerBeat]);

  const handleMouseDown = (pitch: number, beat: number) => {
    const existing = findNoteAt(pitch, beat);
    if (existing) {
      // Remove the note
      onNotesChange(notes.filter((n) => n !== existing));
    } else {
      setDragStart({ pitch, beat });
      setDragEnd(beat);
    }
  };

  const handleMouseMove = (beat: number) => {
    if (dragStart) {
      setDragEnd(beat);
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragEnd !== null) {
      const startBeat = Math.min(dragStart.beat, dragEnd);
      const endBeat = Math.max(dragStart.beat, dragEnd);
      const durationBeats = endBeat - startBeat + 1;
      const newNote: NoteEvent = {
        pitch: dragStart.pitch,
        start: startBeat * secondsPerBeat,
        duration: durationBeats * secondsPerBeat,
        velocity: 100,
      };
      onNotesChange([...notes, newNote]);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  // Clear drag state if mouse is released outside the grid (e.g. on the window)
  useEffect(() => {
    const handleWindowMouseUp = () => {
      setDragStart(null);
      setDragEnd(null);
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, []);

  const isInDrag = (pitch: number, beat: number): boolean => {
    if (!dragStart || dragEnd === null) return false;
    if (pitch !== dragStart.pitch) return false;
    const minBeat = Math.min(dragStart.beat, dragEnd);
    const maxBeat = Math.max(dragStart.beat, dragEnd);
    return beat >= minBeat && beat <= maxBeat;
  };

  const isCellActive = (pitch: number, beat: number): boolean => {
    return activeCellKeys.has(`${pitch}:${beat}`);
  };

  return (
    <div className="piano-roll">
      <div className="piano-roll__body" ref={gridRef}>
        {/* Beat numbers header */}
        <div className="piano-roll__beat-header">
          <div className="piano-roll__key-spacer" />
          {Array.from({ length: totalBeats }, (_, i) => (
            <div
              key={i}
              className={`piano-roll__beat-num ${i % beatsPerBar === 0 ? 'piano-roll__beat-num--bar' : ''}`}
              style={{ width: CELL_WIDTH }}
            >
              {i % beatsPerBar === 0 ? `${Math.floor(i / beatsPerBar) + 1}` : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div className="piano-roll__scroll-area">
          {pitchRows.map((pitch) => (
            <div className="piano-roll__row" key={pitch}>
              {/* Key label */}
              <div
                className={`piano-roll__key ${isBlackKey(pitch) ? 'piano-roll__key--black' : ''} ${pitch % 12 === 0 ? 'piano-roll__key--c' : ''}`}
              >
                {pitch % 12 === 0 || pitch === MIN_PITCH || pitch === MAX_PITCH
                  ? pitchToName(pitch)
                  : isBlackKey(pitch)
                    ? ''
                    : NOTE_NAMES[pitch % 12]}
              </div>

              {/* Cells */}
              {Array.from({ length: totalBeats }, (_, beat) => {
                const active = isCellActive(pitch, beat);
                const dragging = isInDrag(pitch, beat);
                return (
                  <div
                    key={beat}
                    className={`piano-roll__cell ${active ? 'piano-roll__cell--active' : ''} ${dragging ? 'piano-roll__cell--dragging' : ''} ${isBlackKey(pitch) ? 'piano-roll__cell--black-row' : ''} ${beat % beatsPerBar === 0 ? 'piano-roll__cell--bar-line' : ''}`}
                    style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                    onMouseDown={() => handleMouseDown(pitch, beat)}
                    onMouseMove={() => handleMouseMove(beat)}
                    onMouseUp={handleMouseUp}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
