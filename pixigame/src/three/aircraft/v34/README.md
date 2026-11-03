# Aircraft runtime and catalog

The directory name is retained for existing imports. The shared runtime now
supports V39 weapons, propulsion lighting, reversible deployment and V34 aircraft.
Keep the game's adapted `PackageLoader.js`: it owns platform asset URLs and
supports injected object loaders.

`catalog.json` contains eight V39 aircraft from
`IceSwordSkyfall_V39_Clean_Thrusters.zip`, plus the existing V34 `verdant` and
`scarlet` packages, which have no newer replacement in that archive. Pilot IDs
and their aircraft mapping remain unchanged. Runtime asset checksums and source
archive hashes are recorded in `public/fighters/provenance.json`.

The V39 `ConfigFighter`, `DeploymentController`, `DeploymentPose`, `WeaponSystem`
and `WeaponTimeline` come from
the supplied archive. `SpecialFx` honors its explicit `disabled` flag. Legacy
Kestrel part-index modifications must not reparent articulated assemblies.
V39 uses its authored surfaces without legacy detail kits, engraving or crease
lines. Its engine/nav lights and depth-correct orthographic exhaust are retained.
Weapon fire demonstration FX are explicitly disabled in game views. Native
simulation remains responsible for all actual projectiles and damage.
Equipment and aircraft catalog heroes share one live preview canvas. They play
an entrance deployment, hold, reverse to rest and repeat after a quiet interval;
small list cards remain baked images. Preview timing never activates a battle
skill. Native slot 10106 uses the Auric appearance, completing the eight
selectable V39 aircraft without changing native skill or progression IDs.

Local authoring: `node tools/import-fighter-v39.mjs /path/to/archive.zip`, then
rebake the UI images using `/tools/bake-aircraft-ui.html`. The importer verifies
every package checksum before writing and preserves the two unmatched aircraft.
The supplied root manifest and GLB exports are not imported: the V39 root
manifest is stale and its GLBs are unchanged V38 exports. The game reads the
verified per-aircraft V39 structures and buffers directly.
