# Thumb Fighter — Sprites

## Spritesheet

- Each player loads their own spritesheet. Currently both point to the same file.
- Source file: `50×20px` PNG, one file per player (`player1.png`, `player2.png`).
- **No upscale filtering.** Rendering must use `image-rendering: pixelated` (CSS) to preserve pixel art crispness at all scales.
- Sprites are scaled up at runtime via `SPRITE_SCALE` constant. Native frame size is `10×20px`; rendered size is `10 * SPRITE_SCALE` × `20 * SPRITE_SCALE`.

---

## Spritesheet Layout

States are arranged **horizontally** (left to right). Animation frames for each state stack **vertically** (top to bottom).

```
         x=0      x=10     x=20     x=30     x=40
         ┌────────┬────────┬────────┬────────┬────────┐
  y=0    │  IDLE  │ L_PNCH │ R_PNCH │ BLOCK  │ DEFEAT │  ← frame 0
         └────────┴────────┴────────┴────────┴────────┘
  y=20   │  IDLE  │ L_PNCH │ R_PNCH │ BLOCK  │ DEFEAT │  ← frame 1
         └────────┴────────┴────────┴────────┴────────┘
  y=40   │  ...   │  ...   │  ...   │  ...   │  ...   │  ← frame 2
         └────────┴────────┴────────┴────────┴────────┘
```

- **Column index** = state (0=idle, 1=l_punch, 2=r_punch, 3=block, 4=defeat)
- **Row index** = animation frame within that state
- Origin of any frame: `{ x: stateIndex * 10, y: frameIndex * 20 }`
- All coordinates are in **native pixels** before scaling.

---

## State → Spritesheet Column Map

| Body State | Column Index | x Origin |
|---|---|---|
| `default` (idle) | 0 | 0 |
| `l_punch` | 1 | 10 |
| `r_punch` | 2 | 20 |
| `block` | 3 | 30 |
| `defeated` | 4 | 40 |

Head states (`default`, `hit`) are composited on top of the body sprite, not separate columns. Head rendering is a separate draw call using its own sprite region — to be defined when head sprites are produced.

---

## Anim Playback Modes

Each `Anim` instance declares its playback mode explicitly. There is no default — caller always sets it.

| Mode | Behaviour |
|---|---|
| `loop` | Plays frames 0→N then restarts from 0. Runs until `stop()` is called. |
| `once` | Plays frames 0→N once, holds last frame, fires `onComplete`. |
| `pingpong` | Plays frames 0→N→0, then fires `onComplete`. Does not loop. |
| `hold` | Plays frames 0→N once, holds last frame indefinitely. No `onComplete` until `stop()`. |

---

## Per-State Playback Behaviour

| State | Mode | Notes |
|---|---|---|
| `default` (idle) | `loop` | Loops indefinitely until a punch or block input interrupts it. |
| `l_punch` | `pingpong` | Plays forward through punch frames then reverses back to frame 0, then `onComplete` transitions to idle. |
| `r_punch` | `pingpong` | Same as `l_punch`. |
| `block` | `loop` | Loops while both buttons are held. Stops immediately on button release. |
| `defeated` | `hold` | Holds last frame until round or match reset. |

---

## Anim Frame Sequence Definition

An `Anim` that uses spritesheet frames declares a `frames` array. Each entry is a spritesheet coordinate in **native pixels**:

```js
// Frame origin is computed as: { x: stateColumnIndex * FRAME_W, y: frameIndex * FRAME_H }
// The Anim can accept pre-computed origins or derive them from a helper.

const FRAME_W = 10;
const FRAME_H = 20;

// Helper: generate frame origins for a given state column and frame count
function stateFrames(stateIndex, frameCount) {
  return Array.from({ length: frameCount }, (_, i) => ({
    x: stateIndex * FRAME_W,
    y: i * FRAME_H,
  }));
}

// Example: idle anim with 3 frames, looping
const idleAnim = new Anim({
  durationMs:    600,
  playback:      'loop',
  interruptible: true,
  frames:        stateFrames(0, 3), // column 0, 3 vertical frames
  keyframes:     [],                // no game-logic keyframes needed
});

// Example: left punch with 4 frames, ping-pong
const leftPunchAnim = new Anim({
  durationMs:    LEFT_PUNCH_DURATION_MS,
  playback:      'pingpong',
  interruptible: false,
  frames:        stateFrames(1, 4),
  keyframes: [
    { at: PUNCH_PHASE.VULNERABLE_START, onEnter: (p) => p.setVulnerable(true)  },
    { at: PUNCH_PHASE.CONNECT,          onEnter: (p) => p.reportHit('left')    },
    { at: PUNCH_PHASE.RECOVER,          onEnter: (p) => p.setVulnerable(false) },
  ],
});
```

Frame timing within a `pingpong` anim: the forward pass covers `0` → `durationMs * 0.5`, the reverse pass covers `durationMs * 0.5` → `durationMs`. Game-logic keyframes (CONNECT, RECOVER, etc.) are evaluated against the full `durationMs` timeline as usual — they are independent of frame timing.

---

## Rendering

The renderer draws the current frame by clipping the spritesheet to the active frame origin:

```js
// Pseudocode — actual implementation in renderer module
ctx.drawImage(
  spritesheet,
  frame.x, frame.y,          // source clip origin (native px)
  FRAME_W, FRAME_H,           // source clip size (native px)
  destX, destY,               // destination on canvas
  FRAME_W * SPRITE_SCALE,     // destination width
  FRAME_H * SPRITE_SCALE,     // destination height
);
```

`ctx.imageSmoothingEnabled` must be set to `false` before any sprite draw call.

---

## Player Character Positioning

The full player character area is `10×20` native units (`FRAME_W × FRAME_H`). However, the character occupies only the **lower 15 units** of that area during idle and block states. The upper 5 units are reserved for the punch arm extension that crosses the center line into the opponent's area.

To achieve correct overlap at connect frame:

- The player area container is positioned with its **top edge offset 5 native units above the center line** (i.e., `top: centerLine - 5 * SPRITE_SCALE`).
- Both players use the same offset in their own coordinate space (P2's entire area is rotated 180°, so the offset direction is handled automatically).
- At idle/block, the sprite content only occupies rows `y=5` to `y=20` of the frame (the lower 15 units). The top 5 rows are transparent in those states.
- At punch connect frame, the arm extends into the top 5 rows, which now visually cross into the opponent's area due to the 5-unit upward offset.
- The sprite is **not clipped** at the center line — overflow is visible.

This means punch connection is a purely visual overlap: both character containers overlap by 10 native units (5 from each side), and the punch arm of the attacker renders into that shared zone.

---

## CSS Requirements

```css
.sprite-canvas {
  image-rendering: pixelated;   /* Chrome, Edge */
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

Or if using `<canvas>`:
```js
ctx.imageSmoothingEnabled = false;
```

Both must be set. Missing either will cause blurry upscaled sprites.