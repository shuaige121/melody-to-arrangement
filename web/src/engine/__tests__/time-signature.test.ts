// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Arrangement } from '../../types/music.ts';
import { inferBarCount } from '../analysis.ts';
import { arrangementDuration, arrangementToMidi, buildArrangement } from '../midi-generator.ts';

describe('time signature handling', () => {
  it('writes the selected time signature and quarter-note tempo to exported MIDI', () => {
    const arrangement: Arrangement = {
      tracks: [],
      tempoBpm: 120,
      beatsPerBar: 6,
      beatUnit: 8,
      bars: 2,
      style: 'modal',
      complexity: 'basic',
    };

    const midi = arrangementToMidi(arrangement);

    expect(midi.header.timeSignatures[0]?.timeSignature).toEqual([6, 8]);
    expect(midi.header.tempos[0]?.bpm).toBe(120);
  });

  it('uses beatUnit when inferring bar count for compound meters', () => {
    const bars = inferBarCount(
      [{ pitch: 60, start: 1.4, duration: 0.25, velocity: 90 }],
      120,
      6,
      8,
    );

    expect(bars).toBe(2);
  });

  it('preserves beatsPerBar and beatUnit in generated arrangements', () => {
    const arrangement = buildArrangement(
      [{ pitch: 60, start: 0, duration: 0.5, velocity: 90 }],
      [{ rootPc: 0, rootName: 'C', quality: 'maj', symbol: 'C', roman: 'I', tones: [0, 4, 7] }],
      120,
      2,
      'modal',
      'basic',
      3,
      4,
    );

    expect(arrangement.beatsPerBar).toBe(3);
    expect(arrangement.beatUnit).toBe(4);
  });

  it('uses beatUnit when calculating generated arrangement duration', () => {
    const arrangement = buildArrangement(
      [{ pitch: 60, start: 0, duration: 0.25, velocity: 90 }],
      [{ rootPc: 0, rootName: 'C', quality: 'maj', symbol: 'C', roman: 'I', tones: [0, 4, 7] }],
      120,
      2,
      'modal',
      'basic',
      6,
      8,
    );

    const totalDuration = arrangementDuration(arrangement);
    const maxNoteEnd = arrangement.tracks.reduce((trackMax, track) => {
      const trackEnd = track.notes.reduce(
        (noteMax, note) => Math.max(noteMax, note.start + note.duration),
        0,
      );
      return Math.max(trackMax, trackEnd);
    }, 0);

    expect(totalDuration).toBeCloseTo(3, 6);
    expect(maxNoteEnd).toBeLessThanOrEqual(totalDuration + 1e-6);
  });
});
