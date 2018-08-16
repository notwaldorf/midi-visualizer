let templ = document.createElement('template');
templ.innerHTML = `
<style>
  :host { display: block; }
  #container {
    overflow-x: auto;
  }
</style>
<div id="container">
  <canvas id="canvas"></canvas>
</div>
`

// This is needed so that the Shady DOM polyfill scopes
// the styles correctly.
if (window.ShadyCSS)
  window.ShadyCSS.prepareTemplate(templ, 'midi-visualizer');

class MidiVisualizer extends HTMLElement {
  constructor() {
    super();

    // Stamp the template.
    if (window.ShadyCSS)
      window.ShadyCSS.styleElement(this);
    this.attachShadow({mode: 'open'});
    this.shadowRoot.appendChild(document.importNode(templ.content, true));

    // Cache the DOM instances we care about so that we don't
    // keep requerying for them.
    this.$ = {};
    this.$.container = this.shadowRoot.getElementById('container');
    this.$.canvas = this.shadowRoot.getElementById('canvas');

    // Initialize the visualizer and the magenta player.
    this._visualizer = null;
    this._player = new mm.SoundFontPlayer(
        'https://storage.googleapis.com/download.magenta.tensorflow.org/soundfonts_js/sgm_plus'
    );
    this._player.callbackObject = {
      // This method is called every time we play a new note. We use
      // it to keep the visualization in sync with the audio.
      run: (note) => {
        const currentNotePosition = this._visualizer.drawSequence(note);

        // See if we need to scroll the container.
        const containerWidth = this.$.container.getBoundingClientRect().width;
        if (currentNotePosition > (this.$.container.scrollLeft + containerWidth)) {
          this.$.container.scrollLeft = currentNotePosition - 20;
        }
      },
      stop: () => {}
    };
  }

  /********************
   *  Properties this element exposes.
   * ******************/
  get url() { return this.getAttribute('url'); }
  set url(value) {
    this.setAttribute('url', value);
    this._fetchMidi();
  }

  get tempo() { return this._player.desiredQPM; }
  set tempo(value) {
    this.setAttribute('tempo', value);
    this._player.setTempo(value);
  }

  static get noteSequence() { return this._noteSequence; }
  static set noteSequence(value) {
    if (value != this._noteSequence) {
      this._noteSequence = value;
      console.log('should call init visualizer');
    }
  }

  /********************
   *  Public methods this element exposes
   * ******************/
  start() {
    mm.Player.tone.context.resume();
    this._player.start(this.noteSequence);
  }

  stop() {
    this._player.stop();
  }

  // Keep attributes and properties in sync.
  static get observedAttributes() { return ['url', 'tempo']; }
  attributeChangedCallback(attr, oldValue, newValue) {
    if (oldValue === newValue) return;
    this[attr] = newValue;
  }

  _fetchMidi() {
    fetch(this.url)
    .then((response) => {
      return response.blob();
    })
    .then((blob) => {
      this._parseMidiFile(blob);
    })
    .catch(function(error) {
      console.log('Well, something went wrong somewhere. I don\'t know', error.message);
    });
  }

  _parseMidiFile(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
      this.noteSequence = mm.midiToSequenceProto(e.target.result);
      this._initializeVisualizer();
    };

    reader.readAsBinaryString(file);
  }

  async _initializeVisualizer() {
    this._visualizer = new NoteSequenceDrawing(this.noteSequence, this.$.canvas);
    await this._player.loadSamples(this.noteSequence);
    this.dispatchEvent(new CustomEvent('visualizer-ready'));
  }
}

/*************************
 * Visualizing a NoteSequence
 *************************/
class NoteSequenceDrawing {
  constructor(sequence, canvas) {
    this.config = {
      noteHeight: 6,
      noteSpacing: 1,
      pixelsPerTimeStep: 30,  // The bigger this number the "wider" a note looks,
      minPitch: 100,
      maxPitch: 1
    }

    this.noteSequence = sequence;

    // Initialize the canvas.
    this.ctx = canvas.getContext('2d');
    const size = this.getCanvasSize();

    this.height = size.height;
    this.ctx.canvas.width  = size.width;
    this.ctx.canvas.height = size.height;

    this.drawSequence();
  }

  drawSequence(currentNote) {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    let currentNotePosition;

    for (let i = 0; i < this.noteSequence.notes.length; i++) {
      const note = this.noteSequence.notes[i];

      // Size of this note.
      const offset = this.config.noteSpacing * (i + 1);
      const x = (note.startTime * this.config.pixelsPerTimeStep) + offset;
      const w = (note.endTime - note.startTime) * this.config.pixelsPerTimeStep;

      // Note that the canvas y=0 is at the top, but a smaller pitch is actually lower,
      // so we're kind of painting backwards.
      const y = this.height - ((note.pitch - this.config.minPitch) * this.config.noteHeight);

      // Colour of this note.
      const opacity = note.velocity / 100 + 0.2;
      if (this.isPaintingCurrentNote(note, currentNote)) {
        this.ctx.fillStyle=`rgba(240, 84, 119, ${opacity})`;  // pink
      } else if (i <= this.primerNotes) {
        this.ctx.fillStyle=`rgba(111, 201, 198, ${opacity})`;  // teal
      }
      else {
        this.ctx.fillStyle=`rgba(8, 41, 64, ${opacity})`;  // dark blue
      }
      this.ctx.fillRect(x, y, w, this.config.noteHeight);

      if (this.isPaintingCurrentNote(note, currentNote)) {
        currentNotePosition = x;
      }
    }
    return currentNotePosition;
   }

  getCanvasSize() {
    // Find the smallest pitch so that we cans scale the drawing correctly.
    for (let note of this.noteSequence.notes) {
      if (note.pitch < this.config.minPitch) {
        this.config.minPitch = note.pitch;
      }
      if (note.pitch > this.config.maxPitch) {
        this.config.maxPitch = note.pitch;
      }
    }

    // Add a little bit of padding at the top and the bottom;
    this.config.minPitch -= 2;
    this.config.maxPitch += 2;

    // Height of the canvas based on the range of pitches in the sequence
    const height = (this.config.maxPitch - this.config.minPitch) * this.config.noteHeight;

    // Calculate a nice width based on the length of the sequence we're playing.
    const numNotes = this.noteSequence.notes.length;
    const lastNote = this.noteSequence.notes[numNotes - 1];
    const width = (numNotes * this.config.noteSpacing) + (lastNote.endTime * this.config.pixelsPerTimeStep);

    return {width, height};
  }

  isPaintingCurrentNote(note, currentNote) {
    return currentNote &&
          ((note.startTime == currentNote.startTime) ||
           (note.endTime >= currentNote.endTime) &&
          (note.startTime <= currentNote.startTime))
  }
}

window.customElements.define('midi-visualizer', MidiVisualizer);
