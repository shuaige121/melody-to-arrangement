import type { NoteEvent } from '../types/music.ts';

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_VELOCITY = 80;

const PITCH_CLASS_MAP: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const DYNAMICS_TO_VELOCITY: Record<string, number> = {
  ppp: 24,
  pp: 36,
  p: 48,
  mp: 64,
  mf: 80,
  f: 96,
  ff: 112,
  fff: 120,
  sfz: 110,
  fp: 76,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getFirstElementText(parent: Element, selector: string): string | null {
  const element = parent.querySelector(selector);
  return element?.textContent?.trim() ?? null;
}

function readTempoFromSound(parent: ParentNode): number | null {
  const sounds = parent.querySelectorAll('sound[tempo]');
  for (const sound of sounds) {
    const tempoAttr = sound.getAttribute('tempo');
    if (!tempoAttr) {
      continue;
    }
    const tempo = Number.parseFloat(tempoAttr);
    if (Number.isFinite(tempo) && tempo > 0) {
      return tempo;
    }
  }
  return null;
}

function readVelocityFromNote(note: Element): number {
  const dynamicsNode = note.querySelector('dynamics');
  if (!dynamicsNode) {
    return DEFAULT_VELOCITY;
  }

  const numericText = dynamicsNode.textContent?.trim() ?? '';
  if (numericText) {
    const value = Number.parseFloat(numericText);
    if (Number.isFinite(value)) {
      return clamp(Math.round(value), 0, 127);
    }
  }

  const firstDynamicMark = dynamicsNode.firstElementChild?.tagName.toLowerCase();
  if (firstDynamicMark && firstDynamicMark in DYNAMICS_TO_VELOCITY) {
    return DYNAMICS_TO_VELOCITY[firstDynamicMark];
  }

  return DEFAULT_VELOCITY;
}

function parsePitchToMidi(note: Element): number {
  const pitch = note.querySelector('pitch');
  if (!pitch) {
    throw new Error('MusicXML note is missing <pitch>');
  }

  const step = getFirstElementText(pitch, 'step')?.toUpperCase();
  const octaveText = getFirstElementText(pitch, 'octave');
  const alterText = getFirstElementText(pitch, 'alter');

  if (!step || !(step in PITCH_CLASS_MAP)) {
    throw new Error(`Invalid MusicXML pitch step: ${step ?? 'unknown'}`);
  }
  if (!octaveText) {
    throw new Error('MusicXML note is missing <octave>');
  }

  const octave = Number.parseInt(octaveText, 10);
  const alter = alterText ? Number.parseInt(alterText, 10) : 0;

  if (!Number.isFinite(octave)) {
    throw new Error(`Invalid MusicXML octave value: ${octaveText}`);
  }
  if (!Number.isFinite(alter)) {
    throw new Error(`Invalid MusicXML alter value: ${alterText}`);
  }

  const midi = (octave + 1) * 12 + PITCH_CLASS_MAP[step] + alter;
  return clamp(midi, 0, 127);
}

function parseDurationSeconds(note: Element, divisions: number, tempoBpm: number): number {
  const durationText = getFirstElementText(note, 'duration');
  if (!durationText) {
    return 0;
  }

  const durationDivisions = Number.parseFloat(durationText);
  if (!Number.isFinite(durationDivisions) || durationDivisions <= 0) {
    return 0;
  }

  const quarterSeconds = 60 / Math.max(tempoBpm, 1e-6);
  return (durationDivisions / Math.max(divisions, 1e-6)) * quarterSeconds;
}

function parseDivisions(attributes: Element): number | null {
  const divisionsText = getFirstElementText(attributes, 'divisions');
  if (!divisionsText) {
    return null;
  }

  const divisions = Number.parseFloat(divisionsText);
  if (!Number.isFinite(divisions) || divisions <= 0) {
    return null;
  }

  return divisions;
}

export async function parseMusicXmlFile(file: File): Promise<{ notes: NoteEvent[]; tempoBpm: number }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mxl') {
    throw new Error('MXL (compressed MusicXML) not yet supported, please use .xml or .musicxml');
  }

  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, 'application/xml');

  if (xml.querySelector('parsererror')) {
    throw new Error('Invalid MusicXML: could not parse XML document');
  }

  const firstTempo = readTempoFromSound(xml);
  const tempoBpm = firstTempo ?? DEFAULT_TEMPO_BPM;

  const notes: NoteEvent[] = [];

  const parts = Array.from(xml.querySelectorAll('part'));
  if (parts.length === 0) {
    return { notes, tempoBpm };
  }

  for (const part of parts) {
    let divisions = 1;
    let activeTempo = tempoBpm;
    let currentTime = 0;
    let lastNonChordStart = 0;

    const measures = Array.from(part.querySelectorAll(':scope > measure'));
    for (const measure of measures) {
      const children = Array.from(measure.children);

      for (const child of children) {
        const tagName = child.tagName;

        if (tagName === 'attributes') {
          const parsedDivisions = parseDivisions(child);
          if (parsedDivisions !== null) {
            divisions = parsedDivisions;
          }
          continue;
        }

        if (tagName === 'direction') {
          const directionTempo = readTempoFromSound(child);
          if (directionTempo !== null) {
            activeTempo = directionTempo;
          }
          continue;
        }

        if (tagName === 'sound') {
          const tempoAttr = child.getAttribute('tempo');
          if (tempoAttr) {
            const parsed = Number.parseFloat(tempoAttr);
            if (Number.isFinite(parsed) && parsed > 0) {
              activeTempo = parsed;
            }
          }
          continue;
        }

        if (tagName === 'backup' || tagName === 'forward') {
          const durationText = getFirstElementText(child, 'duration');
          if (!durationText) {
            continue;
          }
          const durationDivisions = Number.parseFloat(durationText);
          if (!Number.isFinite(durationDivisions) || durationDivisions <= 0) {
            continue;
          }
          const seconds = (durationDivisions / Math.max(divisions, 1e-6)) * (60 / Math.max(activeTempo, 1e-6));
          currentTime += tagName === 'backup' ? -seconds : seconds;
          if (currentTime < 0) {
            currentTime = 0;
          }
          continue;
        }

        if (tagName !== 'note') {
          continue;
        }

        const isRest = child.querySelector('rest') !== null;
        const isChordNote = child.querySelector('chord') !== null;
        const duration = parseDurationSeconds(child, divisions, activeTempo);

        if (isRest) {
          if (!isChordNote) {
            currentTime += duration;
          }
          continue;
        }

        const startTime = isChordNote ? lastNonChordStart : currentTime;
        const noteEvent: NoteEvent = {
          pitch: parsePitchToMidi(child),
          start: startTime,
          duration,
          velocity: readVelocityFromNote(child),
        };

        notes.push(noteEvent);

        if (!isChordNote) {
          lastNonChordStart = startTime;
          currentTime += duration;
        }
      }
    }
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  return {
    notes,
    tempoBpm,
  };
}
