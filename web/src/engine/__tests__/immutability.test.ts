// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Arrangement, KeyEstimate, MelodyData, NoteEvent } from '../../types/music.ts';

const sampleNote: NoteEvent = { pitch: 60, start: 0, duration: 0.5, velocity: 80 };
const sampleKey: KeyEstimate = { tonicPc: 0, tonicName: 'C', mode: 'major', score: 1 };
const shouldTypeCheckMutation = Boolean(
  (globalThis as typeof globalThis & { __vitestTypeMutationProbe__?: boolean }).__vitestTypeMutationProbe__
);

describe('immutability contracts', () => {
  it('prevents MelodyData readonly fields from being reassigned at the type level', () => {
    const melody: MelodyData = {
      notes: [sampleNote],
      tempoBpm: 120,
      beatsPerBar: 4,
      beatUnit: 4,
      key: sampleKey,
    };

    if (shouldTypeCheckMutation) {
      // @ts-expect-error tempoBpm is readonly
      melody.tempoBpm = 90;
      // @ts-expect-error beatsPerBar is readonly
      melody.beatsPerBar = 3;
      // @ts-expect-error beatUnit is readonly
      melody.beatUnit = 8;
      // @ts-expect-error key is readonly
      melody.key = { ...sampleKey, tonicName: 'G', tonicPc: 7 };
    }

    expect(melody.tempoBpm).toBe(120);
    expect(melody.beatsPerBar).toBe(4);
    expect(melody.beatUnit).toBe(4);
    expect(melody.key).toEqual(sampleKey);
  });

  it('prevents Arrangement.tempoBpm from being reassigned at the type level', () => {
    const arrangement: Arrangement = {
      tracks: [],
      tempoBpm: 128,
      beatsPerBar: 6,
      beatUnit: 8,
      bars: 8,
      style: 'pop',
      complexity: 'basic',
    };

    if (shouldTypeCheckMutation) {
      // @ts-expect-error tempoBpm is readonly
      arrangement.tempoBpm = 100;
      // @ts-expect-error beatsPerBar is readonly
      arrangement.beatsPerBar = 4;
      // @ts-expect-error beatUnit is readonly
      arrangement.beatUnit = 4;
    }

    expect(arrangement.tempoBpm).toBe(128);
    expect(arrangement.beatsPerBar).toBe(6);
    expect(arrangement.beatUnit).toBe(8);
  });
});
