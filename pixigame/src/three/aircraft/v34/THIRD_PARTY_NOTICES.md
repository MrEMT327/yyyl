# Third-party notices

- **Three.js 0.185.1** — Copyright 2010–2026 Three.js Authors. MIT. License: `vendor/three/LICENSE`. The unmodified ESM runtime and selected addons were copied from the user-provided project's dependencies. No font files are distributed.
- **lil-gui 0.21.0** — MIT. License: `vendor/lil-gui/LICENSE.md`. Unmodified ESM build from the user-provided dependencies.
- **LinearAbilityExtThreeJS / related ability sandboxes** — Copyright (c) 2026 mohamedachrefelouafi. MIT. Research and compatibility target; license copy: `docs/UPSTREAM_LICENSE.txt`. The original full project and its third-party art assets are not included.

The local stage, new sword geometry, shader/effect implementation, generated stone textures, test harnesses and integration installer are retained from V2 or modified for V3. The V3 sound is procedurally synthesized and contains no third-party audio samples. See `docs/SOURCES.md` for precise provenance and compatibility limitations.

## V4 additions

The procedural lava-colossus geometry, flowing field, basalt / lava shaders, flame and particle systems, tabs and Inferno PCM synthesizer are new project code. Warcraft III's Infernal was named by the user as a silhouette reference only; no Blizzard game assets, model files, textures, animations or sound samples are included. The V3 ice-rendering source files remain unchanged.

## V7 additions

`src/fighter/upstream/RibbonGeometry.js` and `FlightLights.js` are adapted from
achrefelouafi/LinearAbilityExtThreeJS, Copyright (c) 2026 mohamedachrefelouafi,
MIT, with notice retained in each file and `docs/UPSTREAM_LICENSE.txt`.
`FlightParticles.js` follows the original GPU particle architecture; the new
nozzle-volume shader follows the Meteor proxy-volume design, reimplemented for
plasma exhaust. Exact paths, blob hashes and adaptation scope are recorded in
`docs/v7/UPSTREAM_ADAPTATION.md`.

The airframe, markings, demonstration flight, shield and engine audio are new
procedural project work. The markings use the browser's system fonts at runtime;
no font files, third-party aircraft models, screenshots-as-textures or audio
samples are distributed.

## V13 data-package migration

Historical per-aircraft constructors are no longer part of the browser runtime.
The previously adapted shader code and animation definitions have been frozen
inside `public/fighters/<slug>/effects.json`; the shared Ribbon implementation
remains in `src/fighter/upstream/RibbonGeometry.js`. Model vertices, scene
hierarchies, material definitions, instance attributes and label images are
saved project assets. Marking images were baked during migration using browser
fonts; no font files are included. The five aircraft are original project work,
not models taken from the upstream ability sandboxes.

The current loader, declarative runtime, package validation, asynchronous
selection management and project-default persistence are new project code.
See `docs/v13/ARCHITECTURE.md` for the exact format and migration boundaries.
