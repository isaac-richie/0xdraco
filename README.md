# 侍 Isaac Richie — The Way of the Builder

A 3D portfolio set in shogun-era Japan. As you scroll, the camera flies through a single world at dusk, with a samurai and a ninja performing real motion-captured animations.

It's a static site with no build step: [Three.js](https://threejs.org), GSAP with ScrollTrigger, and Lenis, all loaded from CDNs.

## The journey
| Section | Scene |
|---|---|
| 序 Hero | The samurai draws her katana on a cliff above a castle town while ninjas sprint and flip along the castle wall |
| 道 The Way | A lantern-lit dojo: she kneels in meditation while a ninja sneaks past outside the shōji |
| 武 Arsenal | In a bamboo grove, a ninja throws a 3D shuriken at a straw target as each skill card scrolls in |
| 戦 Campaigns | Project cards slide sideways while the ninja runs and flips across the rooftops at your scroll speed |
| 旅 The Road | The samurai walks through a tunnel of vermilion torii gates, lighting up each milestone |
| 決 The Duel | A motion-captured sword fight, driven by your scroll, with slow motion around each strike and the final cut |

**Sound:** the site has an original soundtrack of shakuhachi flute, koto and taiko drums, composed live in the browser with the Web Audio API. Visitors opt in on the loading screen.

## Run locally
```bash
python3 -m http.server 5173
```
Then open http://localhost:5173.

## Project layout
- `index.html`, `css/`: page structure and styles. The text sits on glass panels over the 3D world.
- `js/three/world.js`: the world itself, built in code: sky, castle, dojo, bamboo grove, rooftops, torii road and duel field.
- `js/three/characters.js`: loads the characters, gives them the rim-lit ink look, and attaches the katana, scabbard and headband to the skeleton.
- `js/three/app.js`: the scroll-driven camera, each section's choreography, the duel timing, and the UI.
- `js/audio.js`: the procedural music and sound effects.
- `assets/models/*.glb`: the characters with their motion clips (about 8 MB). `assets/manifest.json` sets which clip plays where and the duel beat timings.
- `index-2d.html`: the earlier 2D SVG version.

## Credits
Characters and motion capture come from [Mixamo](https://www.mixamo.com) (Kachujin G Rosales, Ninja). Everything else is original and written in code.

## To do
- Replace the placeholder email (`hello@yourdomain.com`) and the X link in `index.html`.
