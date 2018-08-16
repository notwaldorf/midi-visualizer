midi-visualizer
=================

This is a web component that shows you a visualization for a midi file.

## Sample use

```html
<html>
  <head>
    <!-- Web components polyfill, so this works on all browsers -->
  <script src="https://unpkg.com/@webcomponents/webcomponentsjs@^2.0.0/webcomponents-loader.js"></script>

  <!-- Load magenta.js, which is needed by the element. -->
  <script src="https://unpkg.com/@magenta/music@1.1.9/dist/magentamusic.js"></script>

  <!-- Load the web component itself -->
  <script src="midi-visualizer.js"></script>
  </head>
  <body>

  <!-- Use the web component! -->
  <midi-visualizer
  id="visualizer"
  url="https://cdn.glitch.com/3312a3b4-6418-4bed-a0bd-3a0ca4dfa2fb%2Fchopin.mid?1534369337985">
  </midi-visualizer>
  </body>
</html>
```

## Configuring the visualizer
The element has the following properties you can use:
-  the `tempo`, at which the player is playing the midi. You can use this either as a property in JavaScript (eg. `aVisualizer.tempo = 500`) or as attribute in HTML (eg. `<midi-visualizer tempo="200"></midi-visualizer>`)
- the `url` of a midi file to be visualized. You can use this either as a property in JavaScript (eg. `aVisualizer.url = "https://example.com/foo.mid"`) or as attribute in HTML (eg. `<midi-visualizer url="https://example.com/foo.mid"></midi-visualizer>`)
- `noteSequence`: a magenta.js `NoteSequence` object. You can only set this as a JavaScript property (eg. `aVisualizer.noteSequence = new mm.NoteSequence()`)

