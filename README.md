# Keys — Piano Companion

A no-build, local-first piano learning PWA inspired by [Axe](https://github.com/ocodia/axe). This is an independent implementation using native JavaScript modules, Web Components and Web Audio. No package installation, backend, account, CDN or network-based sound library is needed.

## Run

From this directory:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open **http://127.0.0.1:8765/** in Chrome or Edge. `npm run serve` is an optional shorthand if Node is installed; no dependencies are installed. Opening the HTML directly with `file://` is not supported because the app uses ES modules.

## Explore and practise

The keyboard spans the available workspace, with compact tool controls above it. Use the menu button beside **Keys** to show/hide navigation; your preference is remembered. Navigation starts collapsed. Optional explanations are under **Guide**. Both light and dark themes use a restrained instrument-panel layout.

- **Notes:** choose a two-octave, 49-, 61- or 88-key view. The 49-key view starts at C2–C6; 61 keys spans C2–C7. Octave arrows shift the smaller views within the piano's range; the 88-key view covers A0–C8. Your view is remembered.
- **Scales:** all 12 roots, contextual note spelling, interval labels, major/minor variants, pentatonic, blues, chromatic and major-scale modes. Classical melodic minor uses natural minor descending.
- **Chords & inversions:** triads, suspended chords, common sevenths, all inversions, optional left-hand root, and voicing/all-tone highlights.
- **Arpeggios:** one or two octaves, up or down, in the chosen inversion and register.
- **Hand positions:** major/minor five-finger patterns starting on C, G, D, A, E or F; both hands. Finger numbers apply only to these patterns.
- **Chord identifier:** toggle onscreen notes or hold a MIDI chord; see exact matches, alternate names, bass and inversion.
- **Chord palette:** scale-contained triads, suspensions and sevenths across seven modes. An altered card means the scale-specific formula has no exact name in the included chord library.
- **Circle of fifths:** key signatures, relative minors and diatonic chords, with links to the explorer.
- **Progressions:** four curated major-key progressions with Roman numerals, chord functions and deterministic close-position voice leading. Save favourites locally.
- **Quiz:** find notes, name highlighted notes, build chords or play inversions. Ten untimed questions, explicit Check, reveal, scoring and retry of missed questions. Beginner note quizzes use natural notes; chord quizzes use major/minor triads in every root.

Pointer/touch plays notes; in Identifier and Quiz it also toggles selections. Arrow keys move piano focus; Space/Enter plays. Multiple touch pointers can hold chords. MIDI and onscreen answer sources are kept separate: the last source used supplies the answer. A sustained note does not count as a held quiz answer. Use Clear to start over.

## MIDI and audio

Connect a USB MIDI keyboard, open **MIDI** in the header, click **Connect keyboard**, grant browser MIDI permission, and choose an input. Settings and connection details stay in a modal; the header shows a compact connected indicator. Chrome/Edge on Windows is the primary supported setup. Browsers without Web MIDI keep all onscreen tools available. MIDI access requires localhost or HTTPS; no SysEx or MIDI output is requested.

**Play MIDI notes through Keys** defaults on. Your saved on/off choice is preserved; turn it off for digital pianos with their own speakers if you hear doubled notes. Keys remembers the last selected input and automatically restores it when permission is already granted. If it is missing, Keys waits for it instead of silently switching to another keyboard. Unplug/replug reconnects the remembered device. Deselecting the input clears the remembered selection. Browsers without MIDI permission querying require a manual connection.

Velocity, note-off, sustain CC64 and device disconnection are handled. Keys uses a small additive piano-like synthesiser, not acoustic piano samples. Automatic MIDI connection cannot bypass browser autoplay rules: click anywhere in Keys to unlock sound, or use **Enable sound** when shown. Stop, tab hiding, focus loss and input-device changes release all sound.

If connected but silent, choose the keyboard's main **MIDI** input, not **MCU/HUI**, **DAW**, **ALV** or **DIN THRU**. Keys prefers a note-playing port automatically. **Test sound** checks browser output independently of the keyboard; the input indicator shows the most recent note received. Connect MIDI, enabling monitoring, and Test sound unlock browser audio through a user gesture.

## Install and offline use

Allow the first load to finish before going offline. Install using the browser's install control or Keys' Install button when offered. Every runtime asset, including sounds (synthesised in code), is available offline. New versions wait for **Update when ready**; an update stops sound and reloads the app, so finish a quiz first.

Preferences, saved progressions and aggregate quiz statistics are stored under `keys:v1` in browser local storage. Active notes, connections and unfinished quizzes are not persisted. Clearing browser site data removes saved progress. No telemetry is collected.

## Tests

```sh
node tests/run.js
```

For browser/component tests, serve the app and open **http://127.0.0.1:8765/tests/**. See [testing notes](docs/TESTING.md) for actual coverage and the physical-device checklist.

## Static hosting

The root folder can be served as-is from any HTTPS static host, including a GitHub Pages project subdirectory. Keep relative paths and deploy all runtime files and `icons/`. No deployment has been performed. For updates, bump the service-worker cache version whenever a cached runtime file changes.

See [architecture](docs/ARCHITECTURE.md) for module boundaries and extension instructions. Staff reading, songs, microphone recognition, rhythm grading, cloud sync and general-purpose fingering are outside this release.
