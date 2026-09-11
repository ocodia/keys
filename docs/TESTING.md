# Verification

## Verified in this implementation

Piano upgrade (11 September 2026): **21/21 core groups** and **33/33 core + browser groups** passed in Node and headless Microsoft Edge. `/tests/audio-render.html` additionally rendered real Web Audio graphs to check soft/hard dynamics, bass damping, undamped treble, panic and source cleanup. All **480** recordings decoded to non-silent stereo; the decoded cache stayed within its 192 MiB budget. With the browser network disabled, the app reloaded and played six pitches including A0/C8 and transposed notes; all 480 recordings were present in the offline cache. These checks verify signal output and lifecycle, not subjective listening quality or physical keyboard latency.

The earlier app verification below is retained as historical context:

- 15/15 core test groups passed under Node, including remembered MIDI input, permission-gated auto-connect, missing devices and hot replug.
- 27/27 core + browser test groups passed in the Chromium-based in-app browser, including a fresh cache/origin run, navigation collapse/keyboard width, useful details preceding the keyboard in every mode, 49/61-key ranges and octave limits, mobile overflow and modal visibility/focus checks. Escape closing was also verified through browser controls.
- Desktop rendering and first-inversion playback were exercised through real browser controls. The 390px iframe layout passed the overflow and piano-scroll checks.
- The app was reloaded and Scales opened successfully with its separate test server stopped. The main preview server stayed running.
- A waiting service-worker update was applied through the visible update action and loaded the new shell.
- WebMCP configure/read actions succeeded; an invalid mode was rejected.
- The user confirmed audible playback on their connected keyboard after the MIDI port/audio-unlock fix.

Dedicated Chrome/Edge installation checks, physical mobile devices, multitouch and a complete physical sustain/unplug matrix remain manual checks below; these are not claimed as tested.

## Automated core suite

Run `node tests/run.js` (modern Node with ES modules and CustomEvent). Twenty-one groups exercise:

- 88-key geometry and middle C, floating-point geometry tolerance.
- Every scale and chord spelling in every supported root, including E#, B# and double flats.
- All chord qualities/inversions, duplicate octaves, ambiguous augmented/diminished chords.
- Melodic minor direction, arpeggio octave endpoints and scale lengths.
- Every mode/family palette and deterministic minimum-movement progressions.
- Malformed/unavailable storage and persistence round trips.
- Synthetic MIDI, sustain, repeated notes, separate input sources, permissions and hot unplug.
- Quiz pitch-class/exact-register grading, reveal and duplicate submission.
- Audio startup cancellation before an AudioContext resume completes.
- All-key sample mapping and velocity layers; load deduplication, memory eviction and failure retry; pending-note cancellation, source-specific sustain, repeated pedalled strikes, release-tail polyphony and sequence cancellation.

Open `/tests/audio-render.html` for the real audio verification. It decodes every recording (about 76 MiB compressed), renders damper/velocity checks in `OfflineAudioContext`, and exercises muted live-source cleanup. Browser autoplay must be allowed for its live-context check; run with `--autoplay-policy=no-user-gesture-required` in unattended Chromium. The ordinary browser suite continues to stub audible playback.

## Browser suite

Serve the repository and open `/tests/`. It runs the core suite plus registered-mode rendering, selections/identification, scale/finger labels, palette and circle actions, quiz UI, focus navigation, the 88-key range, mobile overflow/keyboard scrolling, and app-shell cache completeness. The iframe uses temporary persistence during testing and restores its initial settings. Sound is stubbed in browser automation to avoid gesture-policy deadlocks; manually test real sound separately.

The 390px/desktop preview buttons provide a visual fixture. The automated mobile check asserts page width is contained and the piano itself scrolls. It is not a substitute for physical multitouch testing.

## Manual release checklist

- A first visit starts in Notes, dark theme, C root, visible note labels, MIDI disconnected and monitoring enabled. A return visit reconnects the last input only with existing permission. Visit all ten tools.
- Play white/black keys using a pointer, two touch pointers and Space/Enter. Release, change focus and hide the tab; no note stays stuck.
- Compare C major root position/first inversion; audition scales both ways, arpeggios and a progression; Stop cancels the whole sequence. Change volume/mute.
- Use a real USB keyboard in Windows Chrome and Edge. Verify device selection, permission denial/retry, velocity, three-note chords, pedal sustain/release, monitor off/on, repeated notes and unplug/replug. Verify quiz answers use held keys, not sustained tails.
- At 390px, scroll navigation and keyboard without page overflow. Check portrait/landscape on Android Chrome and iOS Safari. Check light theme, focus visibility and 200% text enlargement.
- Complete each quiz type, reveal one answer, retry missed questions and reload to verify cumulative statistics.
- Save/load/remove a progression and reload settings. Check corrupt/blocked storage recovery.
- Install the PWA on a supported browser; after precaching, stop the static server or disconnect the network and reload. Use multiple tools and playback offline.
- Bump the cache version with the old page open; confirm an update notice appears, the old version remains usable, and applying the update loads a coherent new shell. Verify unrelated origin caches are untouched.
- Serve under a subdirectory, such as `/keys/`, to check manifest scope and relative modules/assets.

Physical USB MIDI, actual iOS/Android devices, listening quality and browser-level PWA installation require the corresponding hardware/browser. Synthetic tests do not certify those environments.
