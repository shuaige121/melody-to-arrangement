/**
 * General MIDI Instrument Definitions
 *
 * Complete mapping of General MIDI program numbers (0-127) to instrument names
 * and categories, plus the GM percussion map for channel 10 (MIDI channel 9).
 */

export interface GMInstrument {
  program: number;
  name: string;
  category: string;
}

export interface GMPercussion {
  note: number;
  name: string;
}

export const GM_INSTRUMENTS: GMInstrument[] = [
  // Piano (0-7)
  { program: 0, name: 'Acoustic Grand Piano', category: 'Piano' },
  { program: 1, name: 'Bright Acoustic Piano', category: 'Piano' },
  { program: 2, name: 'Electric Grand Piano', category: 'Piano' },
  { program: 3, name: 'Honky-tonk Piano', category: 'Piano' },
  { program: 4, name: 'Electric Piano 1', category: 'Piano' },
  { program: 5, name: 'Electric Piano 2', category: 'Piano' },
  { program: 6, name: 'Harpsichord', category: 'Piano' },
  { program: 7, name: 'Clavinet', category: 'Piano' },

  // Chromatic Percussion (8-15)
  { program: 8, name: 'Celesta', category: 'Chromatic Percussion' },
  { program: 9, name: 'Glockenspiel', category: 'Chromatic Percussion' },
  { program: 10, name: 'Music Box', category: 'Chromatic Percussion' },
  { program: 11, name: 'Vibraphone', category: 'Chromatic Percussion' },
  { program: 12, name: 'Marimba', category: 'Chromatic Percussion' },
  { program: 13, name: 'Xylophone', category: 'Chromatic Percussion' },
  { program: 14, name: 'Tubular Bells', category: 'Chromatic Percussion' },
  { program: 15, name: 'Dulcimer', category: 'Chromatic Percussion' },

  // Organ (16-23)
  { program: 16, name: 'Drawbar Organ', category: 'Organ' },
  { program: 17, name: 'Percussive Organ', category: 'Organ' },
  { program: 18, name: 'Rock Organ', category: 'Organ' },
  { program: 19, name: 'Church Organ', category: 'Organ' },
  { program: 20, name: 'Reed Organ', category: 'Organ' },
  { program: 21, name: 'Accordion', category: 'Organ' },
  { program: 22, name: 'Harmonica', category: 'Organ' },
  { program: 23, name: 'Tango Accordion', category: 'Organ' },

  // Guitar (24-31)
  { program: 24, name: 'Acoustic Guitar (nylon)', category: 'Guitar' },
  { program: 25, name: 'Acoustic Guitar (steel)', category: 'Guitar' },
  { program: 26, name: 'Electric Guitar (jazz)', category: 'Guitar' },
  { program: 27, name: 'Electric Guitar (clean)', category: 'Guitar' },
  { program: 28, name: 'Electric Guitar (muted)', category: 'Guitar' },
  { program: 29, name: 'Overdriven Guitar', category: 'Guitar' },
  { program: 30, name: 'Distortion Guitar', category: 'Guitar' },
  { program: 31, name: 'Guitar Harmonics', category: 'Guitar' },

  // Bass (32-39)
  { program: 32, name: 'Acoustic Bass', category: 'Bass' },
  { program: 33, name: 'Electric Bass (finger)', category: 'Bass' },
  { program: 34, name: 'Electric Bass (pick)', category: 'Bass' },
  { program: 35, name: 'Fretless Bass', category: 'Bass' },
  { program: 36, name: 'Slap Bass 1', category: 'Bass' },
  { program: 37, name: 'Slap Bass 2', category: 'Bass' },
  { program: 38, name: 'Synth Bass 1', category: 'Bass' },
  { program: 39, name: 'Synth Bass 2', category: 'Bass' },

  // Strings (40-47)
  { program: 40, name: 'Violin', category: 'Strings' },
  { program: 41, name: 'Viola', category: 'Strings' },
  { program: 42, name: 'Cello', category: 'Strings' },
  { program: 43, name: 'Contrabass', category: 'Strings' },
  { program: 44, name: 'Tremolo Strings', category: 'Strings' },
  { program: 45, name: 'Pizzicato Strings', category: 'Strings' },
  { program: 46, name: 'Orchestral Harp', category: 'Strings' },
  { program: 47, name: 'Timpani', category: 'Strings' },

  // Ensemble (48-55)
  { program: 48, name: 'String Ensemble 1', category: 'Ensemble' },
  { program: 49, name: 'String Ensemble 2', category: 'Ensemble' },
  { program: 50, name: 'Synth Strings 1', category: 'Ensemble' },
  { program: 51, name: 'Synth Strings 2', category: 'Ensemble' },
  { program: 52, name: 'Choir Aahs', category: 'Ensemble' },
  { program: 53, name: 'Voice Oohs', category: 'Ensemble' },
  { program: 54, name: 'Synth Choir', category: 'Ensemble' },
  { program: 55, name: 'Orchestra Hit', category: 'Ensemble' },

  // Brass (56-63)
  { program: 56, name: 'Trumpet', category: 'Brass' },
  { program: 57, name: 'Trombone', category: 'Brass' },
  { program: 58, name: 'Tuba', category: 'Brass' },
  { program: 59, name: 'Muted Trumpet', category: 'Brass' },
  { program: 60, name: 'French Horn', category: 'Brass' },
  { program: 61, name: 'Brass Section', category: 'Brass' },
  { program: 62, name: 'Synth Brass 1', category: 'Brass' },
  { program: 63, name: 'Synth Brass 2', category: 'Brass' },

  // Reed (64-71)
  { program: 64, name: 'Soprano Sax', category: 'Reed' },
  { program: 65, name: 'Alto Sax', category: 'Reed' },
  { program: 66, name: 'Tenor Sax', category: 'Reed' },
  { program: 67, name: 'Baritone Sax', category: 'Reed' },
  { program: 68, name: 'Oboe', category: 'Reed' },
  { program: 69, name: 'English Horn', category: 'Reed' },
  { program: 70, name: 'Bassoon', category: 'Reed' },
  { program: 71, name: 'Clarinet', category: 'Reed' },

  // Pipe (72-79)
  { program: 72, name: 'Piccolo', category: 'Pipe' },
  { program: 73, name: 'Flute', category: 'Pipe' },
  { program: 74, name: 'Recorder', category: 'Pipe' },
  { program: 75, name: 'Pan Flute', category: 'Pipe' },
  { program: 76, name: 'Blown Bottle', category: 'Pipe' },
  { program: 77, name: 'Shakuhachi', category: 'Pipe' },
  { program: 78, name: 'Whistle', category: 'Pipe' },
  { program: 79, name: 'Ocarina', category: 'Pipe' },

  // Synth Lead (80-87)
  { program: 80, name: 'Lead 1 (square)', category: 'Synth Lead' },
  { program: 81, name: 'Lead 2 (sawtooth)', category: 'Synth Lead' },
  { program: 82, name: 'Lead 3 (calliope)', category: 'Synth Lead' },
  { program: 83, name: 'Lead 4 (chiff)', category: 'Synth Lead' },
  { program: 84, name: 'Lead 5 (charang)', category: 'Synth Lead' },
  { program: 85, name: 'Lead 6 (voice)', category: 'Synth Lead' },
  { program: 86, name: 'Lead 7 (fifths)', category: 'Synth Lead' },
  { program: 87, name: 'Lead 8 (bass + lead)', category: 'Synth Lead' },

  // Synth Pad (88-95)
  { program: 88, name: 'Pad 1 (new age)', category: 'Synth Pad' },
  { program: 89, name: 'Pad 2 (warm)', category: 'Synth Pad' },
  { program: 90, name: 'Pad 3 (polysynth)', category: 'Synth Pad' },
  { program: 91, name: 'Pad 4 (choir)', category: 'Synth Pad' },
  { program: 92, name: 'Pad 5 (bowed)', category: 'Synth Pad' },
  { program: 93, name: 'Pad 6 (metallic)', category: 'Synth Pad' },
  { program: 94, name: 'Pad 7 (halo)', category: 'Synth Pad' },
  { program: 95, name: 'Pad 8 (sweep)', category: 'Synth Pad' },

  // Synth Effects (96-103)
  { program: 96, name: 'FX 1 (rain)', category: 'Synth Effects' },
  { program: 97, name: 'FX 2 (soundtrack)', category: 'Synth Effects' },
  { program: 98, name: 'FX 3 (crystal)', category: 'Synth Effects' },
  { program: 99, name: 'FX 4 (atmosphere)', category: 'Synth Effects' },
  { program: 100, name: 'FX 5 (brightness)', category: 'Synth Effects' },
  { program: 101, name: 'FX 6 (goblins)', category: 'Synth Effects' },
  { program: 102, name: 'FX 7 (echoes)', category: 'Synth Effects' },
  { program: 103, name: 'FX 8 (sci-fi)', category: 'Synth Effects' },

  // Ethnic (104-111)
  { program: 104, name: 'Sitar', category: 'Ethnic' },
  { program: 105, name: 'Banjo', category: 'Ethnic' },
  { program: 106, name: 'Shamisen', category: 'Ethnic' },
  { program: 107, name: 'Koto', category: 'Ethnic' },
  { program: 108, name: 'Kalimba', category: 'Ethnic' },
  { program: 109, name: 'Bagpipe', category: 'Ethnic' },
  { program: 110, name: 'Fiddle', category: 'Ethnic' },
  { program: 111, name: 'Shanai', category: 'Ethnic' },

  // Percussive (112-119)
  { program: 112, name: 'Tinkle Bell', category: 'Percussive' },
  { program: 113, name: 'Agogo', category: 'Percussive' },
  { program: 114, name: 'Steel Drums', category: 'Percussive' },
  { program: 115, name: 'Woodblock', category: 'Percussive' },
  { program: 116, name: 'Taiko Drum', category: 'Percussive' },
  { program: 117, name: 'Melodic Tom', category: 'Percussive' },
  { program: 118, name: 'Synth Drum', category: 'Percussive' },
  { program: 119, name: 'Reverse Cymbal', category: 'Percussive' },

  // Sound Effects (120-127)
  { program: 120, name: 'Guitar Fret Noise', category: 'Sound Effects' },
  { program: 121, name: 'Breath Noise', category: 'Sound Effects' },
  { program: 122, name: 'Seashore', category: 'Sound Effects' },
  { program: 123, name: 'Bird Tweet', category: 'Sound Effects' },
  { program: 124, name: 'Telephone Ring', category: 'Sound Effects' },
  { program: 125, name: 'Helicopter', category: 'Sound Effects' },
  { program: 126, name: 'Applause', category: 'Sound Effects' },
  { program: 127, name: 'Gunshot', category: 'Sound Effects' },
];

/**
 * General MIDI Percussion Map (Channel 10 / MIDI Channel 9)
 *
 * These note numbers map to specific percussion sounds when
 * played on MIDI channel 10 (0-indexed channel 9).
 */
export const GM_PERCUSSION: GMPercussion[] = [
  { note: 27, name: 'High Q' },
  { note: 28, name: 'Slap' },
  { note: 29, name: 'Scratch Push' },
  { note: 30, name: 'Scratch Pull' },
  { note: 31, name: 'Sticks' },
  { note: 32, name: 'Square Click' },
  { note: 33, name: 'Metronome Click' },
  { note: 34, name: 'Metronome Bell' },
  { note: 35, name: 'Acoustic Bass Drum' },
  { note: 36, name: 'Bass Drum 1' },
  { note: 37, name: 'Side Stick' },
  { note: 38, name: 'Acoustic Snare' },
  { note: 39, name: 'Hand Clap' },
  { note: 40, name: 'Electric Snare' },
  { note: 41, name: 'Low Floor Tom' },
  { note: 42, name: 'Closed Hi-Hat' },
  { note: 43, name: 'High Floor Tom' },
  { note: 44, name: 'Pedal Hi-Hat' },
  { note: 45, name: 'Low Tom' },
  { note: 46, name: 'Open Hi-Hat' },
  { note: 47, name: 'Low-Mid Tom' },
  { note: 48, name: 'Hi-Mid Tom' },
  { note: 49, name: 'Crash Cymbal 1' },
  { note: 50, name: 'High Tom' },
  { note: 51, name: 'Ride Cymbal 1' },
  { note: 52, name: 'Chinese Cymbal' },
  { note: 53, name: 'Ride Bell' },
  { note: 54, name: 'Tambourine' },
  { note: 55, name: 'Splash Cymbal' },
  { note: 56, name: 'Cowbell' },
  { note: 57, name: 'Crash Cymbal 2' },
  { note: 58, name: 'Vibraslap' },
  { note: 59, name: 'Ride Cymbal 2' },
  { note: 60, name: 'Hi Bongo' },
  { note: 61, name: 'Low Bongo' },
  { note: 62, name: 'Mute Hi Conga' },
  { note: 63, name: 'Open Hi Conga' },
  { note: 64, name: 'Low Conga' },
  { note: 65, name: 'High Timbale' },
  { note: 66, name: 'Low Timbale' },
  { note: 67, name: 'High Agogo' },
  { note: 68, name: 'Low Agogo' },
  { note: 69, name: 'Cabasa' },
  { note: 70, name: 'Maracas' },
  { note: 71, name: 'Short Whistle' },
  { note: 72, name: 'Long Whistle' },
  { note: 73, name: 'Short Guiro' },
  { note: 74, name: 'Long Guiro' },
  { note: 75, name: 'Claves' },
  { note: 76, name: 'Hi Wood Block' },
  { note: 77, name: 'Low Wood Block' },
  { note: 78, name: 'Mute Cuica' },
  { note: 79, name: 'Open Cuica' },
  { note: 80, name: 'Mute Triangle' },
  { note: 81, name: 'Open Triangle' },
];

/**
 * Look up a GM instrument by program number.
 */
export function getGMInstrument(program: number): GMInstrument | undefined {
  return GM_INSTRUMENTS.find((inst) => inst.program === program);
}

/**
 * Look up a GM percussion sound by MIDI note number.
 */
export function getGMPercussion(note: number): GMPercussion | undefined {
  return GM_PERCUSSION.find((perc) => perc.note === note);
}

/**
 * Get all GM instruments in a given category.
 */
export function getGMInstrumentsByCategory(category: string): GMInstrument[] {
  return GM_INSTRUMENTS.filter((inst) => inst.category === category);
}

/**
 * All unique GM instrument categories.
 */
export const GM_CATEGORIES: string[] = [
  'Piano',
  'Chromatic Percussion',
  'Organ',
  'Guitar',
  'Bass',
  'Strings',
  'Ensemble',
  'Brass',
  'Reed',
  'Pipe',
  'Synth Lead',
  'Synth Pad',
  'Synth Effects',
  'Ethnic',
  'Percussive',
  'Sound Effects',
];

/**
 * Convert a MIDI note number (0-127) to a note name with octave (e.g. "C4").
 */
export function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = noteNames[midi % 12];
  return `${note}${octave}`;
}
