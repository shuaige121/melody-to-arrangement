import { useMemo, useState } from 'react';
import * as Tone from 'tone';
import './ReferencePitch.css';

interface ReferencePitchProps {
  keyEstimate: { key: string; mode: string } | null;
}

const NOTE_PATTERN = /^([A-Ga-g])([#b\u266f\u266d]?)/;

function normalizeNoteName(rawKey: string): string {
  const match = rawKey.trim().match(NOTE_PATTERN);
  if (!match) return 'C';
  const base = match[1].toUpperCase();
  const accidental = match[2].replace('\u266f', '#').replace('\u266d', 'b');
  return `${base}${accidental}`;
}

export default function ReferencePitch({ keyEstimate }: ReferencePitchProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const noteName = useMemo(() => {
    if (!keyEstimate) return 'C';
    return normalizeNoteName(keyEstimate.key);
  }, [keyEstimate]);

  const frequency = useMemo(() => {
    try {
      return Tone.Frequency(`${noteName}4`).toFrequency();
    } catch {
      return null;
    }
  }, [noteName]);

  const playReference = async () => {
    if (!keyEstimate) return;
    await Tone.start();
    const synth = new Tone.Synth().toDestination();
    setIsPlaying(true);
    synth.triggerAttackRelease(`${noteName}4`, '1n');
    setTimeout(() => {
      setIsPlaying(false);
      synth.dispose();
    }, 1200);
  };

  return (
    <div className={`reference-pitch ${keyEstimate ? '' : 'reference-pitch--empty'}`}>
      <div className="reference-pitch__meta">
        <span className="reference-pitch__label">Reference Pitch</span>
        <span className="reference-pitch__key">
          {keyEstimate ? `${keyEstimate.key} ${keyEstimate.mode}` : '未检测到调性'}
        </span>
        <span className="reference-pitch__freq">
          {keyEstimate && frequency ? `${frequency.toFixed(2)} Hz` : '--'}
        </span>
      </div>
      <button
        type="button"
        className="reference-pitch__play-btn"
        onClick={playReference}
        disabled={!keyEstimate || isPlaying}
      >
        {isPlaying ? 'Playing...' : 'Play'}
      </button>
    </div>
  );
}
