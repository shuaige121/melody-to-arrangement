export interface TimeSignatureParts {
  beatsPerBar: number;
  beatUnit: number;
}

const DEFAULT_TIME_SIGNATURE: TimeSignatureParts = {
  beatsPerBar: 4,
  beatUnit: 4,
};

export function parseTimeSignatureString(signature?: string | null): TimeSignatureParts {
  if (!signature || !signature.includes('/')) {
    return DEFAULT_TIME_SIGNATURE;
  }

  const [beatsText, unitText] = signature.split('/', 2);
  const beatsPerBar = Number.parseInt(beatsText, 10);
  const beatUnit = Number.parseInt(unitText, 10);

  if (!Number.isFinite(beatsPerBar) || beatsPerBar <= 0 || !Number.isFinite(beatUnit) || beatUnit <= 0) {
    return DEFAULT_TIME_SIGNATURE;
  }

  return { beatsPerBar, beatUnit };
}

export function formatTimeSignature(beatsPerBar: number, beatUnit: number): string {
  return `${beatsPerBar}/${beatUnit}`;
}

export function quarterNoteSeconds(tempoBpm: number): number {
  return 60 / Math.max(tempoBpm, 1e-6);
}

export function beatUnitSeconds(tempoBpm: number, beatUnit: number): number {
  return quarterNoteSeconds(tempoBpm) * (4 / Math.max(1, beatUnit));
}

export function secondsPerBar(tempoBpm: number, beatsPerBar: number, beatUnit: number): number {
  return beatUnitSeconds(tempoBpm, beatUnit) * beatsPerBar;
}

export function beatsFromSeconds(seconds: number, tempoBpm: number, beatUnit: number): number {
  return seconds / beatUnitSeconds(tempoBpm, beatUnit);
}

export function secondsFromBeats(beats: number, tempoBpm: number, beatUnit: number): number {
  return beats * beatUnitSeconds(tempoBpm, beatUnit);
}
