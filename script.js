let exampleSequence; // the example midi we are loading.
let drawer;

let player;

go();


async function go() {
  // Set up some event listeners
  tempoInput.addEventListener('change', () => player.setTempo(tempoInput.value));
  playBtn.addEventListener('click', () => startOrStop());
  
  initMagentaPlayer();
  getExampleMidi();
}

/*************************
 * Magenta.js specific code
 *************************/
function initMagentaPlayer() {
  // Load a grand piano so that it sounds super nice.
  player = new mm.SoundFontPlayer(
    'https://storage.googleapis.com/download.magenta.tensorflow.org/soundfonts_js/sgm_plus'
  );
  
  player.callbackObject = {
    // This method is called every time we play a new note. We use 
    // it to keep the visualization in sync with the audio.
    run: (note) => {
      const currentNotePosition = drawer.drawSequence(note);
      // See if we need to scroll the container.
      const containerWidth = container.getBoundingClientRect().width;
      if (currentNotePosition > (container.scrollLeft + containerWidth)) {
       document.getElementById('container').scrollLeft = currentNotePosition - 20;
      }
    },
    stop: () => console.log('🎉 Done!')
  };
}

/*************************
 * Midi -> NoteSequence
 *************************/
function getExampleMidi() {
  // Get a midi file, parse it, and display it.
  //fetch('https://cdn.glitch.com/3312a3b4-6418-4bed-a0bd-3a0ca4dfa2fb%2Ftwinkle_twinkle.mid?1534205970400')
  fetch('https://cdn.glitch.com/3312a3b4-6418-4bed-a0bd-3a0ca4dfa2fb%2Fchopin.mid?1534369337985')
  //fetch('https://cdn.glitch.com/3312a3b4-6418-4bed-a0bd-3a0ca4dfa2fb%2Fchpn-p1_format0.mid?1534380785356')
    .then(function(response) {
      return response.blob();
    })
    .then(function(blob) {
      parseMidiFile(blob);
    })
    .catch(function(error) {
      console.log('Well, something went wrong somewhere. I don\'t know', error.message);
    });
}

async function parseMidiFile(file) {
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    exampleSequence = mm.midiToSequenceProto(e.target.result);
    
    // Get ready for drawing.
    drawer = new NoteSequenceDrawing('canvas', exampleSequence);
    
    // We load the samples ahead of time so that we don't have to wait for
    // the sound to be ready when we start playing.
    // See: https://tensorflow.github.io/magenta-js/music/classes/_core_player_.soundfontplayer.html
    await player.loadSamples(exampleSequence);
    playBtn.disabled = false;
    playBtn.textContent = 'play'; 
  };
  
  reader.readAsBinaryString(file);
}


/*************************
 * Visualizing a NoteSequence
 *************************/
class NoteSequenceDrawing {
  constructor(canvasId, sequence) {    
    this.config = {
      noteHeight: 6,
      noteSpacing: 1,
      pixelsPerTimeStep: 30,  // The bigger this number the "wider" a note looks,
      minPitch: 100,
      maxPitch: 1
    }
    
    this.noteSequence = sequence;
    
    // Initialize the canvas.
    const canvas = document.getElementById(canvasId);
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


/*************************
 * General UI things
 *************************/
function loadFile(e) {
  const file = e.target.files[0];
  parseMidiFile(file);
  return false;
}

function startOrStop() {
  if (player.isPlaying()) {
    player.stop();
    playBtn.textContent = 'play';
  } else {
    mm.Player.tone.context.resume();  // enable audio
    player.setTempo(tempoInput.value);
    container.scrollLeft = 0;
    player.start(exampleSequence);
    playBtn.textContent = 'stop';
  }
}
