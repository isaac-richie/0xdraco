# 侍 Isaac Richard — The Way of the Builder

A 3D portfolio set in shogun-era Japan. As you scroll, the camera flies through a single world at dusk, with a samurai and a ninja performing real motion-captured animations.

It's a static site with no build step: [Three.js](https://threejs.org), GSAP with ScrollTrigger, and Lenis, all loaded from CDNs.

## The journey
| Section | Scene |
|---|---|
| 序 Hero | The samurai draws her katana in a field of wind-blown pampas grass on a cliff above a castle town, while ninjas sprint and flip along the castle wall |
| 道 The Way | A lantern-lit dojo: she rises from meditation, draws her katana and runs two-handed sword drills while a ninja sneaks past outside the shōji |
| 武 Arsenal | In a bamboo grove, a ninja drills roundhouse, flip and hurricane kicks, and throws a 3D shuriken at the straw targets as each skill card scrolls in |
| 戦 Campaigns | Project cards slide sideways while the ninja runs and flips across the rooftops at your scroll speed |
| 旅 The Road | Her katana sheathed, the samurai walks a worn stone path through a tunnel of vermilion torii gates as sakura petals drift past, lighting up each milestone |
| 決 The Duel | A standoff over her shoulder under the cherry blossom, then a motion-captured sword fight driven by your scroll, with slow motion around each strike and the final cut |

**Sound:** visitors opt in on the loading screen. Each part of the page has its own recorded epic Japanese track, and the tracks crossfade as you scroll between sections:

| Sections | Track |
|---|---|
| Hero, Campaigns | Epic Japanese Trailer Orchestral |
| The Way, The Road | Silent Blade |
| Arsenal | Intense Taiko War Drums |
| Duel | The Last Samurai |

Each track picks up where it left off when you return to it. In the duel the music swells for the battle, ducks under each sword clash, and settles for the aftermath. The sword sound effects are synthesized live with the Web Audio API. If the tracks can't load, an original procedural score takes over.

## Run locally
```bash
python3 -m http.server 5173
```
Then open http://localhost:5173.

## Project layout
- `index.html`, `css/`: page structure and styles. The text sits on glass panels over the 3D world.
- `js/three/world.js`: the world itself, built in code: sky, castle, dojo, bamboo grove, rooftops, torii road and duel field.
- `js/three/characters.js`: loads the characters, gives them realistic materials with a subtle rim light, and attaches the katana, scabbard and headband to the skeleton.
- `js/three/cinema.js`: the film look: post-processing, HDRI lighting, per-scene grades and atmosphere.
- `js/three/app.js`: the scroll-driven camera, each section's choreography, the duel timing, and the UI.
- `js/audio.js`: the soundtrack player (crossfades, ducking), the sword sound effects, and the fallback procedural score.
- `assets/audio/*.m4a`: the four music tracks (128 kbps AAC, about 11 MB, loaded once sound is turned on).
- `assets/models/*.glb`: the characters with their motion clips (about 9 MB). `assets/manifest.json` sets which clip plays where and the duel beat timings.
- `assets/env/`: the Poly Haven HDRI, textures and props (about 5 MB, loaded in the background).
- `index-2d.html`: the earlier 2D SVG version.

## The film look
- **Lighting:** the "The Sky Is On Fire" sunset HDRI provides image-based light for every character and surface.
- **Post-processing:** depth of field with automatic focus pulls, bloom, ACES tone mapping, and a custom grading shader (contrast, saturation, vignette, film grain, lens fringing, screen-space sun rays).
- **Per-scene grades:** the colour blends as the camera flies between scenes, from sunset to dojo candlelight, golden bamboo, blue-hour rooftops, lantern dusk and a blood-red duel.
- **Atmosphere:** drifting mist, embers, fireflies, wind-blown sakura petals, light shafts, and rain with a lightning strike on the final cut.
- **Direction:** an opening crane shot, chapter title cards between scenes, bows before the duel, and a ninja roll when he lands on the rooftops.
- **Pacing:** sword techniques and kicks play at 78% of real time so every move reads clearly, faint light trails follow fast blade strokes, and every fighter has a soft contact shadow.
- **Phones:** the resolution adapts to hold the frame rate. Phones get FXAA in place of SMAA, half the sun-ray samples and no depth of field, and their glass panels use solid tint because live blur is too costly there.

## Credits
- Characters and motion capture: [Mixamo](https://www.mixamo.com) (Kachujin G Rosales, Ninja), including Ninja Idle, MMA and flip kicks, Hurricane Kick and the Great Sword idle and slash sets.
- HDRI, textures and props (CC0): [Poly Haven](https://polyhaven.com): The Sky Is On Fire, clay roof tiles, painted planks, brown planks, castle wall slates, clay plaster, aerial grass rock, antique katana, katana stand and mossy rock set.
- Music (all royalty-free under the [Pixabay Content License](https://pixabay.com/service/license-summary/)):
  - [Epic Japanese Trailer Orchestral with Shakuhachi and Vocal](https://pixabay.com/music/orchestral-epic-japanese-trailer-orchestral-with-shakuhachi-and-vocal-618593/) by E-orchestral
  - [Silent Blade](https://pixabay.com/music/world-silent-blade-446042/) by RubyZephyr
  - [Intense Taiko War Drums](https://pixabay.com/music/adventure-intense-taiko-war-drums-for-epic-action-and-cinematic-trailers-428826/) by DesiFreeMusic
  - [The Last Samurai](https://pixabay.com/music/orchestral-the-last-samurai-epic-japanese-bushido-cinematic-music-529053/) by ONECinematicStudio
- Everything else is original and written in code.

## To do
- Replace the placeholder email (`hello@yourdomain.com`) and the X link in `index.html`.
