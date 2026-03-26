# Thumb Fighter — UI Layout

## Orientation & Coordinate System

- **Portrait only.** Landscape triggers a rotate-device prompt overlaid on the stage.
- **Player 1** occupies the bottom half of the screen. Controls are right-side-up.
- **Player 2** occupies the top half of the screen. Their entire area — buttons, character, HUD — is rotated 180° so the device can be held from either end.
- The vertical midpoint of the screen is the **center line**. It is not visually marked; the stage is seamless.

---

## Stage

- The full screen is the stage. No chrome, no borders.
- Background is a static or animated top-down environment sprite/texture spanning the full screen.
- The stage is always rendered. All menus, overlays, and UI states render **on top** of the stage with a backdrop of `rgba(0, 0, 0, 0.70)` and a light CSS blur applied to the content behind the overlay (not the overlay itself).

---

## Player Area Layout (described for Player 1; Player 2 is identical, rotated 180°)

Each player area spans exactly half the screen height and full screen width.

### Punch Buttons

- **Left Punch button:** anchored to the bottom-left corner of the player area.
- **Right Punch button:** anchored to the bottom-right corner of the player area.
- Buttons must be large enough for comfortable thumb contact. Recommended minimum touch target: `120px × 120px`. Final sizing should be tested on physical devices.
- Buttons are visually distinct (labeled L / R or iconified) with clear pressed states.
- Block state is triggered when both buttons are held simultaneously — no dedicated block button.

### Character Area

- **Horizontal position:** centered on the screen's horizontal midpoint.
- **Vertical position:** the sprite's top edge is flush with (or within a small fixed padding of) the screen's vertical center line. The sprite extends downward into the player's own area. It does NOT float in the middle of the player's half — it must hug the center line from below (Player 1) or above (Player 2 after rotation).
- **Sprite frame size:** `10×20px` native, aspect ratio `1:2` (width:height). This ratio is fixed — scaling must always preserve it. The actual rendered size is a tunable constant (`SPRITE_WIDTH_PX`; height derived as `SPRITE_WIDTH_PX * 2`). The placeholder rectangle must match this ratio exactly — it will always be taller than it is wide.
- The placeholder should be clearly outlined (e.g., dashed border or contrasting fill) and labeled `[SPRITE]` for dev reference.
- **Idle / Block:** sprite is fully contained within the player's own area.
- **Punching:** the sprite crosses the center line into the opponent's area. The punch animation should visually reach the opponent character's head position. The sprite is not clipped at the center line — it renders above it freely.
- Z-index: the punching player's character should render above the opponent's character while crossing into their area.

### HP Counter (Debug Only)

- Displayed within the player area, near the character zone.
- Shows current HP as a numeric value (e.g., `HP: 8`).
- Controlled by a `DEBUG_SHOW_HP` flag. Hidden in production builds.
- Does not need to be styled; plain text is acceptable.

---

## Character State → Visual Mapping

### Body States

| State | Description |
|---|---|
| `default` | Idle stance. Sprite fully within own area. |
| `l_punch` | Left punch animation. Sprite crosses center line at connect frame. |
| `r_punch` | Right punch animation. Sprite crosses center line at connect frame. |
| `block` | Guard raised. Sprite stays within own area. |
| `defeated` | Knocked-out pose. Shown from HP = 0 until round resets. |

### Head States

| State | Description |
|---|---|
| `default` | Normal expression. |
| `hit` | Hit-reaction expression. Reverts to `default` after a fixed duration (defined in `game-logic.md`). |

---

## Overlay UI States

All overlays use the shaded backdrop (`rgba(0,0,0,0.70)` + blur). The stage remains visible beneath.

### Debug Console Output

- A debug console output area is fixed at the bottom of the screen.
- It is fully click-through except for its copy button (text selection is disabled).
- All `console.log` output is mirrored here in real time.
- A small button allows copying all output to the clipboard.

### Ready Screen (between rounds)

- Shown after round end (or before round 1).
- Each player has a **"Ready" touch target** on their half of the screen, respecting their 180° rotation.
- Round does not proceed until both players have touched Ready.
- Displays current round number and round wins per player.- Implemented as two vertically stacked halves in `main.js` with Player 2 half rotated 180° for correct local orientation.
### Countdown

- Displayed center-screen after both players are ready.
- Sequence: `3 → 2 → 1 → FIGHT`
- Input is disabled during countdown.

### Round End

- Displays winner of the round (e.g., `PLAYER 1 WINS`).
- Brief pause (duration defined in `game-logic.md`), then transitions to Ready Screen.

### Match End

- Displays match winner.
- Option to restart match (returns to Round 1 Ready Screen, resets all state).

----

## Layering Order (z-index, bottom to top)

1. Stage background
2. Character sprites (punching player on top when crossing center line)
3. Debug HP counters
4. Overlay backdrop (blur + black alpha)
5. Overlay UI content (countdown, ready buttons, round/match results)
6. Debug console output area (fixed at bottom, click-through except for copy/selection)