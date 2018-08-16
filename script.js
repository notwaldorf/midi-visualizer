// Set up some event listeners
tempoInput.addEventListener('change', () => visualizer.tempo = tempoInput.value);
playBtn.addEventListener('click', () => startOrStop());
visualizer.addEventListener('visualizer-ready', () => {
  playBtn.disabled = false;
  playBtn.textContent = 'play';
});

function loadFile(e) {
  const file = e.target.files[0];
  //visualizer.url
  //parseMidiFile(file);
  return false;
}

function startOrStop() {
  if (visualizer.isPlaying()) {
    visualizer.stop();
    playBtn.textContent = 'play';
  } else {
    visualizer.tempo = tempoInput.value;
    visualizer.start();
    playBtn.textContent = 'stop';
  }
}
