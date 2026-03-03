import './InstrumentPicker.css';

interface InstrumentPickerProps {
  selectedProgram: number;
  onChange: (program: number) => void;
  label: string;
}

interface InstrumentCategory {
  name: string;
  startProgram: number;
  instruments: string[];
}

const GM_CATEGORIES: InstrumentCategory[] = [
  {
    name: 'Piano',
    startProgram: 0,
    instruments: [
      'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano',
      'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2',
      'Harpsichord', 'Clavinet',
    ],
  },
  {
    name: 'Chromatic Percussion',
    startProgram: 8,
    instruments: [
      'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
      'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    ],
  },
  {
    name: 'Organ',
    startProgram: 16,
    instruments: [
      'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
      'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    ],
  },
  {
    name: 'Guitar',
    startProgram: 24,
    instruments: [
      'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)',
      'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar',
      'Distortion Guitar', 'Guitar Harmonics',
    ],
  },
  {
    name: 'Bass',
    startProgram: 32,
    instruments: [
      'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)',
      'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2',
      'Synth Bass 1', 'Synth Bass 2',
    ],
  },
  {
    name: 'Strings',
    startProgram: 40,
    instruments: [
      'Violin', 'Viola', 'Cello', 'Contrabass',
      'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    ],
  },
  {
    name: 'Ensemble',
    startProgram: 48,
    instruments: [
      'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
      'Choir Aahs', 'Voice Oohs', 'Synth Choir', 'Orchestra Hit',
    ],
  },
  {
    name: 'Brass',
    startProgram: 56,
    instruments: [
      'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
      'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    ],
  },
  {
    name: 'Reed',
    startProgram: 64,
    instruments: [
      'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
      'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    ],
  },
  {
    name: 'Pipe',
    startProgram: 72,
    instruments: [
      'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
      'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    ],
  },
  {
    name: 'Synth Lead',
    startProgram: 80,
    instruments: [
      'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)',
      'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)',
      'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
    ],
  },
  {
    name: 'Synth Pad',
    startProgram: 88,
    instruments: [
      'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)',
      'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)',
      'Pad 7 (halo)', 'Pad 8 (sweep)',
    ],
  },
  {
    name: 'Synth Effects',
    startProgram: 96,
    instruments: [
      'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)',
      'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)',
      'FX 7 (echoes)', 'FX 8 (sci-fi)',
    ],
  },
  {
    name: 'Ethnic',
    startProgram: 104,
    instruments: [
      'Sitar', 'Banjo', 'Shamisen', 'Koto',
      'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
    ],
  },
  {
    name: 'Percussive',
    startProgram: 112,
    instruments: [
      'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
      'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    ],
  },
  {
    name: 'Sound Effects',
    startProgram: 120,
    instruments: [
      'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
      'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
    ],
  },
];

export default function InstrumentPicker({ selectedProgram, onChange, label }: InstrumentPickerProps) {
  return (
    <div className="instrument-picker">
      <label className="instrument-picker__label">{label}</label>
      <select
        className="instrument-picker__select select-control"
        value={selectedProgram}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {GM_CATEGORIES.map((category) => (
          <optgroup key={category.name} label={category.name}>
            {category.instruments.map((name, i) => {
              const program = category.startProgram + i;
              return (
                <option key={program} value={program}>
                  {program}: {name}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
