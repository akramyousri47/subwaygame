# Subway Dash 3D

A 3D endless runner in the browser. Single self-contained HTML file — no build step, no network calls, no server. Just open it.

![gameplay](https://img.shields.io/badge/engine-WebGL%20%2B%20Three.js-blue)

## Play

Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Switch lane | `←` `→` or `A` `D` | swipe left / right |
| Jump | `↑` `W` `Space` | swipe up |
| Roll | `↓` `S` | swipe down |
| Restart | `Space` / `R` on game over | tap |

### Obstacles

- **Subway car** — full lane height. You must change lanes.
- **Construction barrier** — low. Jump over it.
- **Hazard gantry** — overhead. Roll under it.
- **Coins** — collect for bonus score.

Speed ramps from 11 to 26 units/s. Best score is stored in `localStorage`.

## What's in the box

- Real WebGL rendering via Three.js r169, vendored **inline** so the game works offline from `file://` (browsers block ES-module imports on `file://` URLs, so a CDN `<script>` would break local play).
- Humanoid character assembled from ~30 primitives on a real joint hierarchy (hips → spine → chest → neck → head, two-segment arms and legs) with a procedural run cycle, jump tuck, forward barrel roll, and a tumble on crash. Includes face, hair, hoodie, backpack and sneakers.
- PBR-ish lighting: PMREM environment map for reflections, ACES filmic tonemapping, PCF soft shadows, hemisphere + directional + two warm point lights, distance fog.
- Subway tunnel: tiled walls, ribbed supports, ceiling strip lights, rails, gravel sleepers, scrolling floor texture, floating dust particles.
- Object pooling for obstacles and shared geometry/material caches, so there's no GPU memory growth over a long run.

## Repo layout

```
index.html              the playable game (generated — do not hand-edit)
src/game.js             all game logic, physics, animation, rendering setup
src/three.module.js     Three.js r169 (unmodified, vendored)
build.js                concatenates the two into index.html
```

## Building

Edit `src/game.js`, then regenerate `index.html`:

```bash
node build.js
```

`build.js` rewrites Three.js' trailing `export { ... }` statement into a
`const THREE = { ... }` object and inlines it above the game code inside a
single `<script type="module">` block.

## Tuning

Most of the feel lives at the top of `src/game.js`:

| Constant | Meaning |
| --- | --- |
| `LANE_X` | lane centre positions |
| `GRAV`, `JUMP_V` | jump arc |
| `STAND_H`, `ROLL_H` | player collision height, standing vs rolling |
| `TRAIN_LEN` | subway car length (drives difficulty spacing) |
| `speed = Math.min(26, 11 + elapsed * 0.2)` | speed ramp |
| `spawnGap = 20 - ...` | obstacle density |

Camera framing is in `init()` (position) and the `update()` tail (`camY` /
`camZ` / `lookAt`).

## License

© 2026 **Akram Yousri** — created by Akram Yousri. All rights reserved.

Game code: do whatever you want with it. Three.js is MIT, © the Three.js authors.
