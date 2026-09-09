# Architecture

Keys is a static native-ES-module application. `index.html` loads the stylesheet and `app.js` directly. `package.json` only declares ES module semantics for optional Node tests and command shorthands; there is no build or runtime dependency.

## Boundaries

- `app.js`: composition root and semantic actions. Owns transient selections, quiz session, MIDI and audio services; coordinates registered panels and the persistent keyboard component.
- `feature-registry.js`: the single list of feature IDs, navigation groups, titles and custom element tags.
- `panels.js`: registered feature Web Components, pure control/detail markup, and escaping. User intent travels through delegated `data-field` changes and `data-action` buttons to the composition root, then to the Store.
- `keyboard.js`: black/white geometry rendering, pointer capture, multi-pointer input and keyboard accessibility. Paint changes do not replace key nodes, preserving held pointers and focus. A range change rebuilds geometry only after input is stopped.
- `theory.js`: pure pitch-class, spelling, scale, voicing, palette, identifier, geometry and progression calculations. MIDI 60 is C4. MIDI range is 21–108; free labels and contextual spellings are distinct.
- `storage.js`: the sole persistent state writer. Whitelists and validates fields, clamps numeric settings and repairs old/malformed data. `Store.update(patch)` persists and emits `change`. Transient state never enters localStorage.
- `input-service.js`: normalises hardware input and tracks held/sustained sets by source. `PianoAudio` is independent of both rendering and persistence.
- `quiz.js`: pure prompt generation, answer matching and session scoring; the view supplies selected/held pitches on explicit Check.
- `service-worker.js`: versioned, scope-specific precache. Updates wait for an explicit user action. Cache activation removes only prior Keys caches for this exact scope.

## Interfaces

Normalised input events use `{ type, source, pitch?, velocity?, timestamp, down? }`. Types are `note-on`, `note-off`, `sustain` and `all-notes-off`; pitches are integer MIDI values, velocity is 0–1, and sustain uses `down`. MIDI source IDs include device and channel; pointer IDs keep multitouch notes separate. CC120/123 intentionally panic all active input sources.

The router owns `held` and `sounding`. Playback highlights are separate from both and never reach quiz submission. Audio uses `on`, `off`, `sustain`, `sequence`, `settings` and `stop`; stop invalidates pending audio startup as well as cancelling timers and releasing voices. The synth caps voices at 64 and decays them over time.

Voicings retain ascending pitches and rotate low tones up an octave for inversion. Progressions enumerate inversions/octave candidates in the selected two-octave register; each subsequent chord minimises summed corresponding-voice movement. Equal-cost candidates sort lexicographically by MIDI pitches. This is a deterministic local minimum for each transition, not global optimisation over the full progression.

Quizzes compare pitch-class sets except inversion prompts, which require exact MIDI sets. Extra notes fail; octave duplicates are accepted in pitch-class questions. Wrong/revealed answers are recorded once and show the correction. Retry creates a new session from missed questions; statistics include retries. Note-name quizzes answer through letter buttons; other quizzes accept piano selections or held MIDI notes.

Optional feature-detected WebMCP tools configure the visible explorer and read its current mode/root/held notes. They do not request devices, start sound, or publish data. Unsupported browsers ignore registration.

## Add a tool

1. Add one descriptor in the feature registry.
2. Add and sanitise any persistent fields in the Store.
3. Add pure calculations separately from controls; add the panel/detail renderer and a semantic action where needed.
4. Extend keyboard context only if the feature needs new targets or labels.
5. Test calculations and at least one complete browser interaction.
6. Include new runtime assets in the service-worker precache and bump its version. Update the README.

## Compatibility and data

No Axe source, storage migration or server API is required. The schema key is `keys:v1`; unknown properties are discarded. Current storage is device-local and contains settings, the last MIDI input's ID/name/manufacturer, saved progression presets and aggregate counts. On load, MIDI access is restored only when a remembered input exists and the Permissions API reports `granted`; loading never prompts for new permission. Match the saved ID first, then an unambiguous name/manufacturer pair if IDs changed. Hot-unplug retains the preference; explicit deselection clears it. Audio starts through user interaction, separately from automatic MIDI reconnection.
