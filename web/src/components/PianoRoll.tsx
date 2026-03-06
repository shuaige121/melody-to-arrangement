import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, UIEvent } from 'react';
import type { NoteEvent } from '../types/music.ts';
import './PianoRoll.css';

interface PianoRollProps {
  notes: NoteEvent[];
  onNotesChange: (notes: NoteEvent[]) => void;
  bars: number;
  beatsPerBar: number;
  tempoBpm: number;
  trackName?: string;
  readOnly?: boolean;
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

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

type PianoRollMode = 'draw' | 'select' | 'move';

type GridNote = {
  index: number;
  note: NoteEvent;
  pitch: number;
  startBeat: number;
  endBeat: number;
  durationBeats: number;
};

type DrawDragState = {
  pitch: number;
  startBeat: number;
  currentBeat: number;
};

type MoveDragState = {
  noteIndex: number;
  originPitch: number;
  originStartBeat: number;
  durationBeats: number;
  beatOffset: number;
  anchorPitch: number;
  targetPitch: number;
  targetStartBeat: number;
  didMove: boolean;
  startedInMode: 'draw' | 'select';
};

type ResizeDragState = {
  noteIndex: number;
  startBeat: number;
  currentEndBeat: number;
  originalDurationBeats: number;
};

type VelocityEditorState = {
  noteIndex: number;
  value: string;
  x: number;
  y: number;
};

export default function PianoRoll({
  notes,
  onNotesChange,
  bars,
  beatsPerBar,
  tempoBpm,
  trackName,
  readOnly = false,
}: PianoRollProps) {
  const [mode, setMode] = useState<PianoRollMode>('draw');
  const [selectedNoteIndices, setSelectedNoteIndices] = useState<number[]>([]);
  const [drawDrag, setDrawDrag] = useState<DrawDragState | null>(null);
  const [moveDrag, setMoveDrag] = useState<MoveDragState | null>(null);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState | null>(null);
  const [hoverResizeKey, setHoverResizeKey] = useState<string | null>(null);
  const [headerScrollLeft, setHeaderScrollLeft] = useState(0);
  const [velocityEditor, setVelocityEditor] = useState<VelocityEditorState | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const pendingRemoveTimeoutRef = useRef<number | null>(null);
  const nonMoveModeRef = useRef<'draw' | 'select'>('draw');

  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = tempoBpm > 0 ? 60 / tempoBpm : 0.5;

  const pitchRows = useMemo(() => {
    const rows: number[] = [];
    for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
      rows.push(p);
    }
    return rows;
  }, []);

  const gridNotes = useMemo(() => {
    if (totalBeats <= 0) return [] as GridNote[];

    const mapped: GridNote[] = [];
    notes.forEach((note, index) => {
      if (note.pitch < MIN_PITCH || note.pitch > MAX_PITCH) return;

      const rawStartBeat = note.start / secondsPerBeat;
      const rawEndBeat = (note.start + note.duration) / secondsPerBeat;
      const startBeat = clamp(Math.floor(rawStartBeat), 0, totalBeats - 1);
      const endBeat = clamp(Math.ceil(rawEndBeat), startBeat + 1, totalBeats);

      mapped.push({
        index,
        note,
        pitch: note.pitch,
        startBeat,
        endBeat,
        durationBeats: endBeat - startBeat,
      });
    });

    return mapped;
  }, [notes, secondsPerBeat, totalBeats]);

  const activeCellMap = useMemo(() => {
    const map = new Map<string, GridNote>();
    for (const gridNote of gridNotes) {
      for (let beat = gridNote.startBeat; beat < gridNote.endBeat; beat++) {
        map.set(`${gridNote.pitch}:${beat}`, gridNote);
      }
    }
    return map;
  }, [gridNotes]);

  const selectedNoteSet = useMemo(() => new Set(selectedNoteIndices), [selectedNoteIndices]);

  const ghostPreview = useMemo(() => {
    if (!moveDrag || !moveDrag.didMove) return null;
    return {
      pitch: moveDrag.targetPitch,
      startBeat: moveDrag.targetStartBeat,
      endBeat: moveDrag.targetStartBeat + moveDrag.durationBeats,
    };
  }, [moveDrag]);

  const clearPendingRemove = useCallback(() => {
    if (pendingRemoveTimeoutRef.current !== null) {
      window.clearTimeout(pendingRemoveTimeoutRef.current);
      pendingRemoveTimeoutRef.current = null;
    }
  }, []);

  const scheduleRemoveNote = useCallback((noteIndex: number) => {
    clearPendingRemove();

    pendingRemoveTimeoutRef.current = window.setTimeout(() => {
      onNotesChange(notes.filter((_, idx) => idx !== noteIndex));
      setSelectedNoteIndices((prev) => prev
        .filter((idx) => idx !== noteIndex)
        .map((idx) => (idx > noteIndex ? idx - 1 : idx))
      );
      pendingRemoveTimeoutRef.current = null;
    }, 220);
  }, [clearPendingRemove, notes, onNotesChange]);

  const commitVelocityEditor = useCallback(() => {
    if (!velocityEditor || readOnly) {
      setVelocityEditor(null);
      return;
    }

    const noteIndex = velocityEditor.noteIndex;
    if (noteIndex < 0 || noteIndex >= notes.length) {
      setVelocityEditor(null);
      return;
    }

    const parsed = Number.parseInt(velocityEditor.value, 10);
    if (Number.isNaN(parsed)) {
      setVelocityEditor(null);
      return;
    }

    const velocity = clamp(parsed, 0, 127);
    if (notes[noteIndex].velocity !== velocity) {
      const nextNotes = notes.map((note, idx) => (
        idx === noteIndex ? { ...note, velocity } : note
      ));
      onNotesChange(nextNotes);
    }

    setVelocityEditor(null);
  }, [velocityEditor, readOnly, notes, onNotesChange]);

  const commitDrawDrag = useCallback(() => {
    if (!drawDrag || readOnly) {
      setDrawDrag(null);
      return;
    }

    const startBeat = Math.min(drawDrag.startBeat, drawDrag.currentBeat);
    const endBeat = Math.max(drawDrag.startBeat, drawDrag.currentBeat);
    const durationBeats = endBeat - startBeat + 1;

    const newNote: NoteEvent = {
      pitch: drawDrag.pitch,
      start: startBeat * secondsPerBeat,
      duration: durationBeats * secondsPerBeat,
      velocity: 100,
    };

    onNotesChange([...notes, newNote]);
    setSelectedNoteIndices([]);
    setDrawDrag(null);
  }, [drawDrag, readOnly, secondsPerBeat, notes, onNotesChange]);

  const commitMoveDrag = useCallback(() => {
    if (!moveDrag || readOnly) {
      setMoveDrag(null);
      if (mode === 'move') {
        setMode(nonMoveModeRef.current);
      }
      return;
    }

    if (moveDrag.didMove) {
      const nextNotes = notes.map((note, idx) => {
        if (idx !== moveDrag.noteIndex) return note;
        return {
          ...note,
          pitch: moveDrag.targetPitch,
          start: moveDrag.targetStartBeat * secondsPerBeat,
          duration: moveDrag.durationBeats * secondsPerBeat,
        };
      });
      onNotesChange(nextNotes);
    } else if (moveDrag.startedInMode === 'draw') {
      scheduleRemoveNote(moveDrag.noteIndex);
    }

    setMoveDrag(null);
    if (mode === 'move') {
      setMode(nonMoveModeRef.current);
    }
  }, [moveDrag, readOnly, mode, notes, onNotesChange, scheduleRemoveNote, secondsPerBeat]);

  const commitResizeDrag = useCallback(() => {
    if (!resizeDrag || readOnly) {
      setResizeDrag(null);
      return;
    }

    const noteIndex = resizeDrag.noteIndex;
    if (noteIndex < 0 || noteIndex >= notes.length) {
      setResizeDrag(null);
      return;
    }

    const maxDuration = Math.max(1, totalBeats - resizeDrag.startBeat);
    const nextDurationBeats = clamp(
      resizeDrag.currentEndBeat - resizeDrag.startBeat,
      1,
      maxDuration
    );

    if (nextDurationBeats !== resizeDrag.originalDurationBeats) {
      const nextNotes = notes.map((note, idx) => (
        idx === noteIndex
          ? { ...note, duration: nextDurationBeats * secondsPerBeat }
          : note
      ));
      onNotesChange(nextNotes);
    }

    setResizeDrag(null);
  }, [resizeDrag, readOnly, notes, onNotesChange, secondsPerBeat, totalBeats]);

  const finalizePointerInteraction = useCallback(() => {
    if (resizeDrag) {
      commitResizeDrag();
      return;
    }
    if (moveDrag) {
      commitMoveDrag();
      return;
    }
    if (drawDrag) {
      commitDrawDrag();
      return;
    }
  }, [resizeDrag, moveDrag, drawDrag, commitResizeDrag, commitMoveDrag, commitDrawDrag]);

  const handleDeleteSelected = useCallback(() => {
    if (readOnly || selectedNoteIndices.length === 0) return;

    const selected = new Set(selectedNoteIndices);
    const nextNotes = notes.filter((_, idx) => !selected.has(idx));
    onNotesChange(nextNotes);
    setSelectedNoteIndices([]);
  }, [readOnly, selectedNoteIndices, notes, onNotesChange]);

  const handleGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setHeaderScrollLeft(event.currentTarget.scrollLeft);
  }, []);

  const handleCellMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>, pitch: number, beat: number) => {
    event.preventDefault();
    clearPendingRemove();

    if (readOnly || drawDrag || moveDrag || resizeDrag) return;

    if (velocityEditor) {
      setVelocityEditor(null);
    }

    const cellKey = `${pitch}:${beat}`;
    const cellNote = activeCellMap.get(cellKey);
    const isResizeEdge = Boolean(
      cellNote
      && beat === cellNote.endBeat - 1
      && event.nativeEvent.offsetX >= CELL_WIDTH - 6
    );

    if (isResizeEdge && cellNote) {
      setResizeDrag({
        noteIndex: cellNote.index,
        startBeat: cellNote.startBeat,
        currentEndBeat: cellNote.endBeat,
        originalDurationBeats: cellNote.durationBeats,
      });
      return;
    }

    if (cellNote) {
      const startedInMode: 'draw' | 'select' = mode === 'select' ? 'select' : 'draw';
      nonMoveModeRef.current = startedInMode;

      if (mode === 'select') {
        setSelectedNoteIndices((prev) => {
          if (event.shiftKey) {
            if (prev.includes(cellNote.index)) return prev;
            return [...prev, cellNote.index];
          }
          return [cellNote.index];
        });
      }

      setMoveDrag({
        noteIndex: cellNote.index,
        originPitch: cellNote.pitch,
        originStartBeat: cellNote.startBeat,
        durationBeats: cellNote.durationBeats,
        beatOffset: beat - cellNote.startBeat,
        anchorPitch: pitch,
        targetPitch: cellNote.pitch,
        targetStartBeat: cellNote.startBeat,
        didMove: false,
        startedInMode,
      });
      return;
    }

    if (mode === 'select') {
      setSelectedNoteIndices([]);
      return;
    }

    if (mode === 'draw') {
      setDrawDrag({
        pitch,
        startBeat: beat,
        currentBeat: beat,
      });
    }
  }, [
    clearPendingRemove,
    readOnly,
    drawDrag,
    moveDrag,
    resizeDrag,
    velocityEditor,
    activeCellMap,
    mode,
  ]);

  const handleCellMouseEnter = useCallback((pitch: number, beat: number) => {
    if (drawDrag) {
      if (pitch !== drawDrag.pitch) return;
      if (beat !== drawDrag.currentBeat) {
        setDrawDrag({ ...drawDrag, currentBeat: beat });
      }
      return;
    }

    if (moveDrag) {
      const maxStartBeat = Math.max(0, totalBeats - moveDrag.durationBeats);
      const targetStartBeat = clamp(beat - moveDrag.beatOffset, 0, maxStartBeat);
      const pitchDelta = pitch - moveDrag.anchorPitch;
      const targetPitch = clamp(moveDrag.originPitch + pitchDelta, MIN_PITCH, MAX_PITCH);

      const didMove = (
        targetStartBeat !== moveDrag.originStartBeat
        || targetPitch !== moveDrag.originPitch
      );

      if (didMove && mode !== 'move') {
        setMode('move');
      }

      if (
        targetStartBeat !== moveDrag.targetStartBeat
        || targetPitch !== moveDrag.targetPitch
        || didMove !== moveDrag.didMove
      ) {
        setMoveDrag({
          ...moveDrag,
          targetStartBeat,
          targetPitch,
          didMove,
        });
      }
      return;
    }

    if (resizeDrag) {
      const nextEndBeat = clamp(beat + 1, resizeDrag.startBeat + 1, totalBeats);
      if (nextEndBeat !== resizeDrag.currentEndBeat) {
        setResizeDrag({ ...resizeDrag, currentEndBeat: nextEndBeat });
      }
    }
  }, [drawDrag, moveDrag, resizeDrag, totalBeats, mode]);

  const handleCellMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>, pitch: number, beat: number) => {
    if (readOnly || drawDrag || moveDrag || resizeDrag) return;

    const cellNote = activeCellMap.get(`${pitch}:${beat}`);
    const isResizeHandle = Boolean(
      cellNote
      && beat === cellNote.endBeat - 1
      && event.nativeEvent.offsetX >= CELL_WIDTH - 6
    );
    const nextKey = isResizeHandle ? `${pitch}:${beat}` : null;

    if (nextKey !== hoverResizeKey) {
      setHoverResizeKey(nextKey);
    }
  }, [readOnly, drawDrag, moveDrag, resizeDrag, activeCellMap, hoverResizeKey]);

  const handleCellMouseLeave = useCallback((pitch: number, beat: number) => {
    const key = `${pitch}:${beat}`;
    if (hoverResizeKey === key) {
      setHoverResizeKey(null);
    }
  }, [hoverResizeKey]);

  const handleCellDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>, pitch: number, beat: number) => {
    if (readOnly) return;

    const cellNote = activeCellMap.get(`${pitch}:${beat}`);
    if (!cellNote) return;

    event.preventDefault();
    clearPendingRemove();

    const rootRect = rootRef.current?.getBoundingClientRect();
    const left = rootRect ? event.clientX - rootRect.left + 8 : event.clientX;
    const top = rootRect ? event.clientY - rootRect.top + 8 : event.clientY;

    setSelectedNoteIndices([cellNote.index]);
    setVelocityEditor({
      noteIndex: cellNote.index,
      value: String(cellNote.note.velocity),
      x: left,
      y: top,
    });
  }, [readOnly, activeCellMap, clearPendingRemove]);

  const setPrimaryMode = useCallback((nextMode: 'draw' | 'select') => {
    nonMoveModeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const handleClearAll = useCallback(() => {
    if (readOnly) return;
    clearPendingRemove();
    onNotesChange([]);
    setSelectedNoteIndices([]);
    setVelocityEditor(null);
  }, [readOnly, clearPendingRemove, onNotesChange]);

  useEffect(() => {
    setSelectedNoteIndices((prev) => prev.filter((idx) => idx >= 0 && idx < notes.length));
  }, [notes.length]);

  useEffect(() => {
    if (!velocityEditor) return;
    if (velocityEditor.noteIndex < 0 || velocityEditor.noteIndex >= notes.length) {
      setVelocityEditor(null);
    }
  }, [velocityEditor, notes.length]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      finalizePointerInteraction();
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [finalizePointerInteraction]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }

      if (selectedNoteIndices.length > 0) {
        event.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [readOnly, selectedNoteIndices.length, handleDeleteSelected]);

  useEffect(() => {
    return () => {
      clearPendingRemove();
    };
  }, [clearPendingRemove]);

  const toolbarMode = mode === 'move' ? nonMoveModeRef.current : mode;

  return (
    <div className="piano-roll" ref={rootRef}>
      <div className="piano-roll__toolbar">
        {trackName ? <span>{trackName}</span> : null}

        <button
          type="button"
          className={`piano-roll__mode-btn ${toolbarMode === 'draw' ? 'piano-roll__mode-btn--active' : ''}`}
          onClick={() => setPrimaryMode('draw')}
          disabled={readOnly}
        >
          Draw
        </button>

        <button
          type="button"
          className={`piano-roll__mode-btn ${toolbarMode === 'select' ? 'piano-roll__mode-btn--active' : ''}`}
          onClick={() => setPrimaryMode('select')}
          disabled={readOnly}
        >
          Select
        </button>

        <button
          type="button"
          className="piano-roll__mode-btn"
          onClick={handleClearAll}
          disabled={readOnly || notes.length === 0}
        >
          Clear All
        </button>
      </div>

      <div className="piano-roll__body">
        <div className="piano-roll__header-scroll">
          <div className="piano-roll__beat-header">
            <div className="piano-roll__key-spacer" />
            <div style={{ display: 'flex', transform: `translateX(${-headerScrollLeft}px)` }}>
              {Array.from({ length: totalBeats }, (_, beat) => (
                <div
                  key={beat}
                  className={`piano-roll__beat-num ${beat % beatsPerBar === 0 ? 'piano-roll__beat-num--bar' : ''}`}
                  style={{ width: CELL_WIDTH }}
                >
                  {beat % beatsPerBar === 0 ? `${Math.floor(beat / beatsPerBar) + 1}` : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="piano-roll__scroll-area" onScroll={handleGridScroll}>
          {pitchRows.map((pitch) => (
            <div className="piano-roll__row" key={pitch}>
              <div
                className={`piano-roll__key ${isBlackKey(pitch) ? 'piano-roll__key--black' : ''} ${pitch % 12 === 0 ? 'piano-roll__key--c' : ''}`}
              >
                {pitch % 12 === 0 || pitch === MIN_PITCH || pitch === MAX_PITCH
                  ? pitchToName(pitch)
                  : isBlackKey(pitch)
                    ? ''
                    : NOTE_NAMES[pitch % 12]}
              </div>

              {Array.from({ length: totalBeats }, (_, beat) => {
                const cellKey = `${pitch}:${beat}`;
                const cellNote = activeCellMap.get(cellKey);
                const isActive = Boolean(cellNote);
                const isSelected = Boolean(cellNote && selectedNoteSet.has(cellNote.index));
                const isGhost = Boolean(
                  ghostPreview
                  && pitch === ghostPreview.pitch
                  && beat >= ghostPreview.startBeat
                  && beat < ghostPreview.endBeat
                );
                const isDragging = Boolean(
                  drawDrag
                  && pitch === drawDrag.pitch
                  && beat >= Math.min(drawDrag.startBeat, drawDrag.currentBeat)
                  && beat <= Math.max(drawDrag.startBeat, drawDrag.currentBeat)
                );

                const isEndCell = Boolean(cellNote && beat === cellNote.endBeat - 1);
                const isStartCell = Boolean(cellNote && beat === cellNote.startBeat);
                const isResizeHandle = !readOnly && hoverResizeKey === cellKey;
                const showLabel = Boolean(cellNote && isStartCell && cellNote.durationBeats * CELL_WIDTH >= 32);

                const cellClassName = [
                  'piano-roll__cell',
                  isActive ? 'piano-roll__cell--active' : '',
                  isSelected ? 'piano-roll__cell--selected' : '',
                  isGhost ? 'piano-roll__cell--ghost' : '',
                  isDragging ? 'piano-roll__cell--dragging' : '',
                  isBlackKey(pitch) ? 'piano-roll__cell--black-row' : '',
                  beat % beatsPerBar === 0 ? 'piano-roll__cell--bar-line' : '',
                  isEndCell && isResizeHandle ? 'piano-roll__cell--resize-handle' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={beat}
                    className={cellClassName}
                    style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                    onMouseDown={(event) => handleCellMouseDown(event, pitch, beat)}
                    onMouseEnter={() => handleCellMouseEnter(pitch, beat)}
                    onMouseMove={(event) => handleCellMouseMove(event, pitch, beat)}
                    onMouseLeave={() => handleCellMouseLeave(pitch, beat)}
                    onDoubleClick={(event) => handleCellDoubleClick(event, pitch, beat)}
                  >
                    {cellNote && isStartCell ? (
                      <>
                        <span
                          className="piano-roll__velocity-bar"
                          style={{ height: `${Math.round((clamp(cellNote.note.velocity, 0, 127) / 127) * 100)}%` }}
                        />
                        {showLabel ? (
                          <span className="piano-roll__note-label">{pitchToName(cellNote.pitch)}</span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {velocityEditor ? (
        <div
          style={{
            position: 'absolute',
            left: velocityEditor.x,
            top: velocityEditor.y,
            zIndex: 20,
            padding: '4px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
          }}
        >
          <input
            type="number"
            min={0}
            max={127}
            value={velocityEditor.value}
            onChange={(event) => {
              setVelocityEditor((prev) => {
                if (!prev) return null;
                return { ...prev, value: event.target.value };
              });
            }}
            onBlur={commitVelocityEditor}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitVelocityEditor();
              } else if (event.key === 'Escape') {
                setVelocityEditor(null);
              }
            }}
            autoFocus
            style={{ width: 52 }}
          />
        </div>
      ) : null}
    </div>
  );
}
