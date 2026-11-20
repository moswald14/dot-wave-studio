// SPDX-License-Identifier: GPL-3.0-only
// Doodle Jazz by moswald14. Adapted for Dot Wave Studio on 2026-11-20.
// Source: https://github.com/moswald14/doodle-jazz/tree/c1238d9f010c42507ce2efb591dd6d36b725c277
// The procedural composer and validators are retained. The live synthesizer,
// payment flow, storage, and site UI are separate from this note generator.
(function (root) {
  'use strict';
  // Original trio arrangements informed by genre features, not recorded songs.
  // Clave: Berklee PULSE, Create Your Own Afro-Latin Groove.
  // Cool/modal: Herbie Hancock Institute, Jazz in America lesson 6.
  // Jazz funk: Trinity Rock & Pop, Improvising in a Fusion Style.
  const genres = {
    swing: { name: 'Velvet swing', label: 'Swing', description: 'Walking bass, a swinging ride and a 32-bar song form.', tempo: 112, swing: 0.64, tonic: 10, bars: 32, mode: 'major', straight: false },
    blues: { name: 'Blue hour', label: 'Blues', description: 'A relaxed twelve-bar blues with dominant-color turnarounds.', tempo: 82, swing: 0.61, tonic: 5, bars: 12, mode: 'major', straight: false },
    bossa: { name: 'Bossa garden', label: 'Bossa', description: 'Minor-key Brazilian-inspired two-feel and interlocking straight rhythms.', tempo: 128, swing: 0.5, tonic: 2, bars: 16, mode: 'minor', straight: true },
    bebop: { name: 'Bebop', label: 'Bebop', description: 'Quick ii–V turns, secondary dominants and chromatic neighbors.', tempo: 168, swing: 0.58, tonic: 0, bars: 32, mode: 'major', straight: false },
    cool: { name: 'Cool jazz', label: 'Cool', description: 'Soft brushes, spacious comping and a restrained melodic conversation.', tempo: 96, swing: 0.58, tonic: 3, bars: 16, mode: 'major', straight: false },
    modal: { name: 'Modal jazz', label: 'Modal', description: 'Long Dorian vamps, open space and a grounded two-feel bass.', tempo: 108, swing: 0.56, tonic: 2, bars: 16, mode: 'minor', straight: false },
    latin: { name: 'Afro-Cuban jazz', label: 'Latin', description: 'A two-bar 2–3 son clave, anticipated bass and montuno-style comping.', tempo: 144, swing: 0.5, tonic: 0, bars: 16, mode: 'minor', straight: true },
    funk: { name: 'Jazz funk', label: 'Jazz funk', description: 'Short minor/dominant vamps, sixteenth syncopation and a firm backbeat.', tempo: 104, swing: 0.5, tonic: 4, bars: 16, mode: 'minor', straight: true }
  };
  const DJ_GENRES = Object.freeze(Object.fromEntries(Object.entries(genres).map(([id, genre]) => [id, Object.freeze({ ...genre })])));
  const DJ_GENRE_IDS = Object.freeze(Object.keys(DJ_GENRES));

  const one = (root, quality) => [{ root, quality, start: 0, beats: 4 }];
  const two = (a, aq, b, bq) => [{ root: a, quality: aq, start: 0, beats: 2 }, { root: b, quality: bq, start: 2, beats: 2 }];

  /** Return a fresh relative chart for one of the additional arrangements. */
  function djGenreChart(style) {
    if (style === 'bebop') {
      const a = [two(0, '6/9', 9, '7'), two(2, 'm9', 7, '13'), two(4, 'm9', 9, '7♭9'), two(2, 'm9', 7, '13'),
        two(0, 'maj9', 5, '9'), two(4, 'm9', 9, '7'), two(2, 'm9', 7, '7♭9'), one(0, '6/9')];
      const bridge = [one(4, '7'), one(9, '13'), one(2, '7'), one(7, '13'),
        two(4, 'm9', 9, '7'), two(2, 'm9', 7, '13'), two(0, '6/9', 9, '7'), two(2, 'm9', 7, '7♭9')];
      return [...a, ...a, ...bridge, ...a].map(bar => bar.map(chord => ({ ...chord })));
    }
    if (style === 'cool') return [
      one(0, 'maj9'), one(0, '6/9'), one(2, 'm9'), one(7, '13'), one(4, 'm9'), one(9, '7'), one(2, 'm9'), one(7, '13'),
      one(8, 'maj9'), one(8, 'maj9'), one(5, 'm9'), one(10, '13'), one(3, 'maj9'), one(6, '13'), two(2, 'm9', 7, '13'), one(0, '6/9')
    ];
    if (style === 'modal') return Array.from({ length: 16 }, (_, i) => one(i >= 8 && i < 12 ? 1 : 0, 'm9'));
    if (style === 'latin') return [
      one(0, 'm9'), one(0, 'm6'), one(5, 'm9'), one(7, '7♭9'), one(0, 'm9'), one(10, '13'), one(3, 'maj9'), one(8, 'maj9'),
      one(5, 'm9'), one(10, '13'), one(3, 'maj9'), one(8, '7'), one(2, 'ø7'), one(7, '7♭9'), two(0, 'm6', 7, '7♭9'), one(0, 'm9')
    ];
    if (style === 'funk') return [
      ...Array.from({ length: 4 }, () => one(0, 'm9')), one(5, '13'), one(5, '13'), one(0, 'm9'), one(0, 'm9'),
      one(10, '13'), one(10, '13'), one(5, '13'), one(5, '13'), one(0, 'm9'), one(0, 'm9'), one(7, '7♭9'), one(0, 'm9')
    ];
    return null;
  }

  const JAZZ_METERS = Object.freeze([2, 3, 4, 5, 6, 7]);
  const JAZZ_PHRASE_BARS = Object.freeze(['genre', 4, 8, 16, 32]);
  const JAZZ_BEAT_PATTERNS = Object.freeze({
    genre: 'Follow the genre', swing: 'Swing ride', cool: 'Quiet brushes', bossa: 'Bossa', latin: 'Latin clave', funk: 'Funk backbeat'
  });
  const JAZZ_ARRANGEMENT_DEFAULTS = Object.freeze({
    beatsPerBar: 4, phraseBars: 'genre', beatPattern: 'genre', beatOnly: false, keyRoot: 'auto', favorLikes: true
  });
  const validJazzRequestId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  const invalid = message => Object.assign(new Error(message), { status: 400 });
  function validateJazzArrangement(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('Choose valid Jazz arrangement settings.');
    const out = { ...JAZZ_ARRANGEMENT_DEFAULTS };
    for (const key of Object.keys(out)) if (Object.hasOwn(value, key)) out[key] = value[key];
    if (!JAZZ_METERS.includes(out.beatsPerBar) || !JAZZ_PHRASE_BARS.includes(out.phraseBars)
      || typeof out.beatPattern !== 'string' || !Object.hasOwn(JAZZ_BEAT_PATTERNS, out.beatPattern)
      || typeof out.beatOnly !== 'boolean' || typeof out.favorLikes !== 'boolean'
      || !(out.keyRoot === 'auto' || Number.isInteger(out.keyRoot) && out.keyRoot >= 0 && out.keyRoot <= 11)) throw invalid('The Jazz arrangement settings are outside their range.');
    return out;
  }

  const JAZZ_CHORD_QUALITIES = Object.freeze(['maj9', 'm9', '13', '7', '7♭9', 'ø7', '6/9', 'm6', '9']);
  const JAZZ_DRUMS = Object.freeze(['kick', 'hat', 'brush', 'stick', 'ride']);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function integer(value, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid Jazz number.'); return value; }
  function number(value, min, max) { if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid Jazz number.'); return value; }
  function text(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f<>]/.test(value)) throw new Error('Invalid Jazz text.');
    return value.trim();
  }
  function validateJazzProgression(input) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 8) throw new Error('Invalid Jazz progression.');
    return input.map(chord => {
      if (!object(chord) || !JAZZ_CHORD_QUALITIES.includes(chord.quality)) throw new Error('Invalid Jazz chord.');
      return { root: integer(chord.root, 0, 11), quality: chord.quality };
    });
  }
  function validateJazzResult(input) {
    if (!object(input) || !Array.isArray(input.pattern) || input.pattern.length < 2 || input.pattern.length > 24) throw new Error('The new beat was not valid.');
    const used = new Set();
    const pattern = input.pattern.map(hit => {
      if (!object(hit) || !JAZZ_DRUMS.includes(hit.instrument)) throw new Error('The new beat used an unknown instrument.');
      const step = integer(hit.step, 0, 15), key = hit.instrument + ':' + step;
      if (used.has(key)) throw new Error('The new beat repeated a hit.'); used.add(key);
      return { instrument: hit.instrument, step, velocity: number(hit.velocity, 0.08, 0.65) };
    }).sort((a, b) => a.step - b.step || a.instrument.localeCompare(b.instrument));
    return { title: text(input.title, 80), description: text(input.description, 180), pattern };
  }

  const DJ_NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const DJ_CHORDS = {
    maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], '13': [0, 4, 7, 10, 14, 21],
    '7': [0, 4, 7, 10], '7♭9': [0, 4, 7, 10, 13], 'ø7': [0, 3, 6, 10],
    '6/9': [0, 4, 7, 9, 14], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14]
  };
  const DJ_STYLES = DJ_GENRES;
  const djClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const DJ_MOTIFS = [[0, 2, 4, 2], [0, 3, 5, 3], [0, -2, -3, 0], [0, 2, 0, -2], [0, -1, 2, 0]];
  const DJ_CALL_RHYTHMS = [[0, 0.5, 1.5, 2], [0, 1, 1.5, 2.5], [0.5, 1, 2, 2.5]];
  const DJ_GENRE_RHYTHMS = {
    bebop: [[0, 0.5, 1.5, 2.5], [0.5, 1, 1.5, 2.5], [0, 0.5, 1, 2.5]],
    cool: [[0, 1.5, 2.5], [0.5, 1.5, 2.75], [0, 1, 2.5]],
    modal: [[0, 1.5, 3], [0.5, 1.5, 2.75], [0, 1, 2.5]],
    latin: [[0, 0.75, 1.5, 2.75], [0.5, 1, 2.5, 3.5], [0, 1.5, 2, 3.25]],
    funk: [[0, 0.75, 1.75, 2.5], [0.25, 1, 2.5, 3.25], [0, 1.25, 2, 3.5]]
  };

  // Thirds and sevenths (sixths on sixth chords) carry the harmony. Enumerate
  // nearby rootless shapes and keep common tones instead of jumping to fixed
  // registers. One color tone leaves room for the bass and the melody.
  function djVoiceLead(root, quality, previous = []) {
    const intervals = DJ_CHORDS[quality];
    if (!intervals) throw new Error('Unknown jazz chord quality.');
    const pitchClass = n => (n % 12 + 12) % 12;
    const candidates = interval => Array.from({ length: 25 }, (_, i) => i + 52)
      .filter(note => pitchClass(note) === pitchClass(root + interval));
    const colors = quality === '13' ? [14, 21] : [intervals[4] ?? intervals[2]];
    const target = previous.length === 3 ? previous : [55, 60, 65];
    let best = null, bestCost = Infinity;
    for (const third of candidates(intervals[1])) for (const seventh of candidates(intervals[3])) {
      for (const color of colors) for (const extension of candidates(color)) {
        const notes = [third, seventh, extension].sort((a, b) => a - b);
        if (notes[1] - notes[0] < 2 || notes[2] - notes[1] < 2 || notes[2] - notes[0] > 17) continue;
        const motion = notes.reduce((sum, note, i) => sum + Math.abs(note - target[i]), 0);
        const cost = motion + Math.abs(notes[1] - 61) * 0.08 + (notes[2] - notes[0]) * 0.025;
        if (cost < bestCost) { best = notes; bestCost = cost; }
      }
    }
    if (!best) throw new Error('No playable jazz voicing.');
    return best;
  }

  class DJRandom {
    constructor(seed) { this.state = (seed >>> 0) || 1; }
    next() {
      let v = this.state;
      v ^= v << 13; v ^= v >>> 17; v ^= v << 5;
      this.state = v >>> 0;
      return this.state / 4294967296;
    }
    pick(a) { return a[Math.floor(this.next() * a.length)]; }
  }

  function djValidateFavoriteProgressions(input) {
    if (!Array.isArray(input) || input.length > 32) throw new Error('Invalid favorite Jazz progressions.');
    return input.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Object.hasOwn(DJ_STYLES, entry.style)
        || !Number.isInteger(entry.tonic) || entry.tonic < 0 || entry.tonic > 11) throw new Error('Invalid favorite Jazz progression.');
      const weight = Object.hasOwn(entry, 'weight') ? entry.weight : 1;
      if (!Number.isInteger(weight) || weight < 1 || weight > 100) throw new Error('Invalid favorite Jazz weight.');
      return { style: entry.style, tonic: entry.tonic, chords: validateJazzProgression(entry.chords), weight,
        ...(entry.part ? { part: validateJazzResult(entry.part) } : {}),
        ...(validJazzRequestId(entry.grooveId) ? { grooveId: entry.grooveId } : {}) };
    });
  }

  class DJComposer {
    constructor(config = {}) {
      this.rng = new DJRandom(config.seed || 7);
      this.config = { style: 'swing', tempo: 112, swing: 0.64, ...config, ...validateJazzArrangement(config),
        favoriteProgressions: Object.hasOwn(config, 'favoriteProgressions') ? djValidateFavoriteProgressions(config.favoriteProgressions) : [] };
      this.pending = null;
      this.barIndex = 0; this.chordIndex = 0;
      this.bar = 0; this.chorus = 0; this.set = 1; this.lastMelody = 72; this.lastBass = 41;
      this.tonic = this.config.keyRoot === 'auto' ? DJ_STYLES[this.config.style].tonic : this.config.keyRoot;
      this.motif = [...DJ_MOTIFS[0]];
      this.phrase = null; this.lastVoicing = [];
      this.favorite = null;
      this.recallNext = true;
      this.requestedProgression = null;
    }
    configure(change) {
      const arrangement = validateJazzArrangement({ ...this.config, ...this.pending, ...change });
      this.pending = { ...this.pending, ...change, ...arrangement,
        ...(Object.hasOwn(change, 'favoriteProgressions') ? { favoriteProgressions: djValidateFavoriteProgressions(change.favoriteProgressions) } : {}) };
    }
    applyPending() {
      if (!this.pending) return;
      const change = this.pending; this.pending = null;
      const reset = (change.style && change.style !== this.config.style) || change.newSet
        || ['beatsPerBar', 'phraseBars', 'keyRoot'].some(key => Object.hasOwn(change, key) && change[key] !== this.config[key]);
      if (change.seed) { this.rng = new DJRandom(change.seed); this.config.seed = change.seed; }
      if (change.style && DJ_STYLES[change.style]) this.config.style = change.style;
      if (Number.isFinite(change.tempo)) this.config.tempo = djClamp(change.tempo, 55, 180);
      if (Number.isFinite(change.swing)) this.config.swing = djClamp(change.swing, 0.5, 0.72);
      Object.assign(this.config, validateJazzArrangement({ ...this.config, ...change }));
      if (Object.hasOwn(change, 'favoriteProgressions')) {
        this.config.favoriteProgressions = change.favoriteProgressions;
        this.recallNext = true;
      }
      if (reset) {
        this.bar = 0; this.chorus = 0; this.set++;
        this.recallNext = true;
        this.tonic = (DJ_STYLES[this.config.style].tonic + this.rng.pick([0, 0, 2, 5, 7])) % 12;
        if (this.config.keyRoot !== 'auto') this.tonic = this.config.keyRoot;
        this.motif = [...this.rng.pick(DJ_MOTIFS)];
        this.phrase = null; this.lastVoicing = []; this.favorite = null;
        this.requestedProgression = change.playProgression || null;
      }
    }
    genreChart() {
      const extra = djGenreChart(this.config.style);
      if (extra) return extra;
      const one = (root, quality) => [{ root, quality, start: 0, beats: 4 }];
      const two = (a, aq, b, bq) => [{ root: a, quality: aq, start: 0, beats: 2 }, { root: b, quality: bq, start: 2, beats: 2 }];
      if (this.config.style === 'blues') return [
        one(0, '9'), one(5, '9'), one(0, '9'), one(0, '13'), one(5, '9'), one(5, '9'),
        one(0, '9'), one(9, '7'), one(2, 'm9'), one(7, '13'), two(0, '9', 9, '7'), two(2, 'm9', 7, '13')
      ];
      if (this.config.style === 'bossa') return [
        one(0, 'm9'), one(0, 'm6'), one(2, 'ø7'), one(7, '7♭9'), one(0, 'm9'), one(0, 'm9'), one(5, 'm9'), one(10, '13'),
        one(3, 'maj9'), one(8, 'maj9'), one(2, 'ø7'), one(7, '7♭9'), one(0, 'm9'), one(8, '7'), two(2, 'ø7', 7, '7♭9'), two(0, 'm6', 7, '7♭9')
      ];
      const a = [one(0, 'maj9'), one(9, '7'), one(2, 'm9'), one(7, '13'), two(4, 'm9', 9, '7'),
        two(2, 'm9', 7, '13'), two(0, '6/9', 9, '7'), two(2, 'm9', 7, '13')];
      const bridge = [one(4, '7'), one(4, '13'), one(9, '7'), one(9, '13'), one(2, '7'), one(2, '13'), one(7, '7'), one(7, '13')];
      return [...a, ...a, ...bridge, ...a];
    }
    chooseProgression() {
      this.favorite = null;
      const choices = this.config.favorLikes ? this.config.favoriteProgressions.filter(entry => entry.style === this.config.style) : [];
      const recall = this.recallNext;
      this.recallNext = false;
      // The legacy random stream is untouched when no matching feedback exists.
      if (this.requestedProgression) {
        this.favorite = this.requestedProgression;
        this.requestedProgression = null;
      } else if (!choices.length || (!recall && this.rng.next() >= 0.65)) return;
      else if (recall) this.favorite = choices[0];
      else {
        let position = this.rng.next() * choices.reduce((sum, entry) => sum + entry.weight, 0);
        this.favorite = choices.find(entry => (position -= entry.weight) < 0) || choices.at(-1);
      }
      this.tonic = this.config.keyRoot === 'auto' ? this.favorite.tonic : this.config.keyRoot;
      this.motif = [...this.rng.pick(DJ_MOTIFS)]; this.phrase = null;
    }
    chart() {
      const source = this.favorite ? this.favorite.chords.map(chord => [{ root: (chord.root - this.favorite.tonic + 12) % 12,
        quality: chord.quality, start: 0, beats: 4 }]) : this.genreChart();
      const length = this.config.phraseBars === 'genre' ? DJ_STYLES[this.config.style].bars : this.config.phraseBars;
      return source.length === length ? source : Array.from({ length }, (_, index) => source[index % source.length]);
    }
    absoluteChord(c) { return { ...c, root: (c.root + this.tonic) % 12 }; }
    nearestPitch(pc, previous, low, high) {
      let best = low, distance = Infinity;
      for (let n = low; n <= high; n++) if ((n % 12 + 12) % 12 === (pc % 12 + 12) % 12 && Math.abs(n - previous) < distance) {
        best = n; distance = Math.abs(n - previous);
      }
      return best;
    }
    nextBar() {
      this.applyPending();
      if (this.bar === 0) this.chooseProgression();
      const meter = this.config.beatsPerBar;
      const source = this.chart(), chart = meter === 4 ? source : source.map(bar => bar.map((chord, index) => ({ ...chord,
        start: index ? Math.ceil(meter / 2) : 0, beats: bar.length === 1 ? meter : index ? Math.floor(meter / 2) : Math.ceil(meter / 2) })));
      const chords = chart[this.bar].map(c => this.absoluteChord(c));
      const nextChord = this.absoluteChord(chart[(this.bar + 1) % chart.length][0]);
      const phase = ['The melody', 'Piano wandering', 'A little breathing room', 'All together'][this.chorus % 4];
      const style = this.config.style, genre = DJ_STYLES[style];
      const events = [], rng = this.rng, bossa = style === 'bossa';
      const callRhythms = DJ_GENRE_RHYTHMS[style] || DJ_CALL_RHYTHMS;
      const seconds = 60 / this.config.tempo, swing = this.config.swing;
      const expand = rhythm => {
        if (meter === 4) return rhythm;
        const out = [];
        for (let offset = 0; offset < meter; offset += 4) for (const beat of rhythm) if (offset + beat < meter) out.push(offset + beat);
        return out;
      };
      const phraseBar = this.bar % 4, phraseRole = ['call', 'repeat', 'answer', 'cadence'][phraseBar];
      if (phraseBar === 0 || !this.phrase) {
        const rhythm = rng.pick(callRhythms);
        this.phrase = { rhythm: [...rhythm], callNotes: [], anchor: djClamp(this.lastMelody + rng.pick([-2, 0, 2]), 65, 75),
          delay: Math.min(0.018, seconds * (0.018 + rng.next() * 0.012)), level: 0.92 + rng.next() * 0.08 };
        if (style === 'cool') this.phrase.anchor = djClamp(this.phrase.anchor, 67, 72);
      }
      const drumStyle = this.config.beatPattern === 'genre' ? style : this.config.beatPattern;
      const drumSwing = this.config.beatPattern === 'genre' ? swing : DJ_STYLES[drumStyle].swing;
      const when = (beat, feel = swing) => {
        const whole = Math.floor(beat), frac = beat - whole;
        return (whole + (frac <= 0.5 ? frac * 2 * feel : feel + (frac - 0.5) * 2 * (1 - feel))) * seconds;
      };
      const add = (instrument, note, beat, beats, velocity, role = instrument, roll = 0) => {
        // The rhythm section anchors the pulse. Swing/blues melody downbeats sit
        // a little behind it, consistently through a phrase; offbeats line up.
        // Bossa keeps its straight grid. These are compositional choices, not a
        // claim that one timing offset reproduces every musician's swing.
        for (const onset of role === 'drums' ? expand([beat]) : [beat]) {
          if (onset >= meter) continue;
          const delay = !genre.straight && role === 'melody' && Number.isInteger(onset) ? this.phrase.delay : 0;
          const time = when(onset, role === 'drums' ? drumSwing : swing) + delay + roll;
          const duration = meter === 4 ? Math.max(0.05, beats * seconds) : Math.min(Math.max(0.05, beats * seconds), meter * seconds - time);
          if (duration > 0) events.push({ instrument, role, note, beat: onset, time, duration, velocity });
        }
      };
      const at = beat => chords.findLast(c => c.start <= beat) || chords[0];
      // Sparse accompaniment answers in the lead's rests. The bossa pattern
      // retains its own interlocking rhythm rather than borrowing swing comping.
      let compRhythm = bossa ? [0, 0.75, 1.5, 2.5, 3.25] : [[0.5, 3], [1, 3.5], [0, 2.75], [2, 3]][phraseBar];
      if (style === 'bebop') compRhythm = [[0.5, 1.5, 2.5, 3.5], [0, 1.5, 3], [0.5, 2, 3.5], [1, 2.5, 3.5]][phraseBar];
      else if (style === 'cool') compRhythm = [[0.5], [2.5], [0, 3], [2.5]][phraseBar];
      else if (style === 'modal') compRhythm = [0, 2.5];
      else if (style === 'latin') compRhythm = this.bar % 2 ? [0.5, 1, 1.5, 2.5, 3, 3.5] : [0, 0.5, 1.5, 2, 2.5, 3.5];
      else if (style === 'funk') compRhythm = [0.25, 0.75, 1.75, 2.5, 3.25];
      compRhythm = expand(compRhythm);
      for (const c of chords) {
        const rhythm = compRhythm.filter(b => b >= c.start && b < c.start + c.beats);
        if (!rhythm.length) continue;
        const voicing = djVoiceLead(c.root, c.quality, this.lastVoicing);
        this.lastVoicing = voicing;
        for (const beat of rhythm) {
          let level = (beat >= 3 ? 0.21 : 0.16) * (this.chorus % 4 === 2 ? 0.8 : 1);
          if (style === 'cool') level *= 0.7;
          else if (style === 'modal') level *= 0.78;
          const duration = style === 'cool' ? 1.3 : style === 'modal' ? 1.4 : style === 'funk' ? 0.28 : style === 'latin' ? 0.4 : bossa ? 0.56 : 0.72;
          voicing.forEach((note, i) => add('piano', note, beat, duration, level * [0.88, 1, 0.8][i], 'piano', i * 0.003));
        }
      }
      // A walking line approaches each following harmony; bossa uses a two-feel.
      const bassPattern = style === 'cool' || style === 'modal' ? [0, 2] : style === 'latin' ? [0, 1.5, 2.5, 3.5] :
        style === 'funk' ? [0, 0.75, 1.5, 2.75, 3.5] : bossa ? [0, 1.5, 2, 3.5] : [0, 1, 2, 3];
      const bassBeats = expand(bassPattern);
      bassBeats.forEach((beat, i) => {
        const step = i % bassPattern.length;
        const c = at(beat), intervals = DJ_CHORDS[c.quality];
        let pc = c.root;
        if (style === 'modal') pc += i ? 7 : 0;
        else if (style === 'cool') pc += i ? intervals[2] : 0;
        else if (style === 'latin') pc = i === 3 ? nextChord.root : c.root + (i % 2 ? intervals[2] : 0);
        else if (style === 'funk') pc += [0, 0, intervals[2], intervals[3], 12][step];
        else if (bossa) pc += i % 2 ? intervals[2] : 0;
        else if (meter === 4 ? i === 3 : i === bassBeats.length - 1) pc = nextChord.root + rng.pick([-1, 1]);
        else if (step === 1) pc += rng.pick([intervals[1], intervals[2]]);
        else if (step === 2) pc += rng.pick([0, intervals[2], intervals[3]]);
        let note = this.nearestPitch(pc, i === 0 ? 38 : this.lastBass, 33, 52);
        if (i === 0 && note > 45) note -= 12;
        this.lastBass = note;
        const length = style === 'cool' || style === 'modal' ? 1.7 : style === 'funk' ? 0.45 : bossa ? 1.12 : 0.9;
        add('bass', note, beat, length, [0.76, 0.58, 0.68, 0.56, 0.64][i % 5]);
      });
      // Four related bars: call, repeat its rhythm with a new ending, answer in
      // another direction/register, then a guide-tone cadence and real silence.
      // The motif remains recognizable during the solo and sparse choruses too.
      let leadBeats = [...this.phrase.rhythm];
      if (phraseRole === 'answer') leadBeats = [...callRhythms[(callRhythms.findIndex(r => r.every((b, i) => b === leadBeats[i])) + 1) % callRhythms.length]];
      if (phraseRole === 'cadence') leadBeats = leadBeats.filter(b => b <= 1.5).slice(0, 2);
      else if (this.chorus % 4 === 2) leadBeats = leadBeats.slice(0, 3);
      if (meter !== 4) leadBeats = [...new Set(leadBeats.map(beat => Math.round(beat * meter) / 4).filter(beat => beat < meter))];
      leadBeats.forEach((beat, i) => {
        const c = at(beat), intervals = DJ_CHORDS[c.quality], last = i === leadBeats.length - 1;
        const answer = phraseRole === 'answer';
        const contour = (answer ? -1 : 1) * this.motif[i % this.motif.length];
        const target = djClamp(this.phrase.anchor + (answer ? 3 : 0) + contour, 60, 82);
        const tones = last && (phraseRole === 'repeat' || phraseRole === 'cadence') ? [intervals[1], intervals[3]] :
          style === 'modal' ? [0, 2, 3, 5, 7, 9, 10] : style === 'funk' ? [0, 3, 5, 7, 10] : intervals;
        let choices = tones.map(t => this.nearestPitch(c.root + t, target, 60, 84));
        if (phraseRole === 'repeat' && last) {
          const endings = choices.filter(note => note !== this.phrase.callNotes[i]);
          if (endings.length) choices = endings;
        }
        let note = choices.sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0];
        if (style === 'bebop' && !last && i % 2 === 1) {
          note = Math.min(84, this.nearestPitch(c.root + intervals[1], target, 60, 83) + 1);
        }
        if (phraseRole === 'call') this.phrase.callNotes[i] = note;
        this.lastMelody = note;
        let energy = [0.94, 1, 0.72, 0.9][this.chorus % 4];
        if (style === 'cool') energy *= 0.72;
        else if (style === 'modal') energy *= 0.85;
        const accent = [1, 0.72, 0.9, 0.64][i];
        const length = phraseRole === 'cadence' && last ? 0.65 : style === 'cool' ? 0.68 : style === 'modal' ? 0.95 :
          style === 'funk' ? 0.25 : Number.isInteger(beat) ? 0.46 : 0.32;
        add('piano', note, beat, length, 0.52 * energy * accent * this.phrase.level * (phraseRole === 'cadence' ? 0.82 : 1), 'melody');
      });
      if (drumStyle === 'cool') {
        [0, 1, 2, 3].forEach((beat, i) => add('brush', 0, beat, 0.3, i % 2 ? 0.3 : 0.2, 'drums'));
        [1, 3].forEach(beat => add('hat', 0, beat, 0.2, 0.25, 'drums'));
        [0, 2].forEach(beat => add('ride', 0, beat, 0.6, 0.18, 'drums'));
      } else if (drumStyle === 'modal') {
        [0, 1, 2, 2.5, 3].forEach(beat => add('ride', 0, beat, 0.6, beat === 2.5 ? 0.2 : 0.36, 'drums'));
        [1, 3].forEach(beat => add('hat', 0, beat, 0.2, 0.32, 'drums'));
        add('brush', 0, 3, 0.3, 0.2, 'drums');
      } else if (drumStyle === 'latin') {
        // Son clave has two attacks in one bar and three in the other. Keep its
        // direction stable while bass and comping interlock around it.
        (this.bar % 2 ? [0, 1.5, 3] : [1, 2]).forEach(beat => add('stick', 0, beat, 0.2, 0.42, 'drums'));
        [0, 0.5, 1.5, 2, 2.5, 3.5].forEach(beat => add('ride', 0, beat, 0.5, 0.24, 'drums'));
        [0, 1, 2, 3].forEach(beat => add('hat', 0, beat, 0.2, 0.32, 'drums'));
      } else if (drumStyle === 'funk') {
        for (let step = 0; step < 16; step++) add('hat', 0, step / 4, 0.2, step % 4 === 0 ? 0.42 : step % 2 === 0 ? 0.3 : 0.18, 'drums');
        [1, 3].forEach(beat => add('stick', 0, beat, 0.2, 0.62, 'drums'));
        [1.75, 3.25].forEach(beat => add('brush', 0, beat, 0.3, 0.16, 'drums'));
      } else if (drumStyle === 'bossa') {
        [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((beat, i) => add('hat', 0, beat, 0.2, i % 2 ? 0.34 : 0.48, 'drums'));
        [0, 1.5, 2.5, 3].forEach(beat => add('stick', 0, beat, 0.2, 0.36, 'drums'));
      } else {
        [0, 1, 1.5, 2, 3, 3.5].forEach((beat, i) => add('ride', 0, beat, 0.6, [0.4, 0.65, 0.28, 0.4, 0.65, 0.28][i], 'drums'));
        [1, 3].forEach(beat => { add('hat', 0, beat, 0.2, 0.46, 'drums'); add('brush', 0, beat, 0.3, 0.37, 'drums'); });
        if (this.bar % 4 === 3) add('brush', 0, 3.5, 0.3, 0.42, 'drums');
        if (drumStyle === 'bebop') add('brush', 0, 2.5, 0.3, 0.36, 'drums');
      }
      (drumStyle === 'funk' ? [0, 0.75, 2, 2.75] : drumStyle === 'cool' ? [0] : [0, 2])
        .forEach(beat => add('kick', 0, beat, 0.2, drumStyle === 'cool' ? 0.18 : 0.28, 'drums'));
      events.sort((a, b) => a.time - b.time);
      const info = { seed: this.config.seed || 7, style: this.config.style, tempo: this.config.tempo, swing: this.config.swing,
        beatsPerBar: meter, phraseBars: this.config.phraseBars, beatPattern: this.config.beatPattern,
        beatOnly: this.config.beatOnly, keyRoot: this.config.keyRoot, favorLikes: this.config.favorLikes, tonic: this.tonic,
        fromFavorite: this.favorite !== null,
        phase: phase + ' · ' + phraseRole, phraseRole,
        key: DJ_NOTES[this.tonic] + (style === 'modal' ? ' Dorian' : genre.mode === 'minor' ? ' minor' : ' major'), bar: this.bar + 1, bars: chart.length,
        chorus: this.chorus + 1, set: this.set,
        barIndex: this.barIndex++,
        chords: chords.map(c => ({ beat: c.start, text: DJ_NOTES[c.root] + c.quality,
          root: c.root, quality: c.quality, index: this.chordIndex++ })) };
      this.bar++;
      if (this.bar === chart.length) {
        this.bar = 0; this.chorus++;
        if (this.chorus % 4 === 0) {
          this.tonic = (this.tonic + rng.pick([0, 5, 7])) % 12;
          if (this.config.keyRoot !== 'auto') this.tonic = this.config.keyRoot;
          this.set++;
          this.motif = [...rng.pick(DJ_MOTIFS)];
        }
      }
      return { events: this.config.beatOnly ? events.filter(event => event.role === 'drums') : events, info, duration: seconds * meter };
    }
  }
  const api = Object.freeze({ DJComposer, DJ_STYLES, DJRandom });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DoodleJazzComposer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
