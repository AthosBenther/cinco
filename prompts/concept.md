# Thumb Fighter — Concept Document

## Overview

A local-multiplayer, front-end-only fighting game designed for two players sharing a single mobile device or tablet. Players hold opposite ends of the device in portrait mode and use their thumbs to punch and block. No backend, no accounts, no network — entirely self-contained in the browser.

---

## Device & Orientation

- **Target devices:** Mobile phones and tablets.
- **Orientation:** Portrait only. The game should lock to portrait and prompt the user to rotate if landscape is detected.
- **Input:** Native multi-touch. Each player operates their own touch zone on their half of the screen. Both players may have touches active simultaneously.

---

## Players

- Two players: **Player 1** (left side) and **Player 2** (right side).
- Player 2's UI is rotated 180° so both players face the screen from their end of the device.
- Each player character is composed of two independent objects:
  - **Body** — handles punch and block states.
  - **Head** — handles hit reaction state.

---

## Art Style

- **Pixel art sprites.**
- Top-down perspective.
- Characters should read clearly at small sizes since screen real estate is shared.
- Animations are sprite-sheet based, driven by JS frame timing.

---

## Game Structure

### Session Flow

1. Title / start screen. Both players must touch "Ready" to begin
2. Pre-round countdown (3–2–1–FIGHT).
3. Round in progress.
4. Round end — winner announced, brief pause.
5. Return to step 2 for next round, or go to match-end screen.

### Win Condition

- Each player starts with a fixed HP total (to be defined in `game-logic.md`. 10 if no definition).
- First player to reach **0 HP loses the round**.
- Match is **best of 3 rounds**.
- The player who wins 2 rounds wins the match.

### Rounds

- Each round awaits for both players to tounch "ready", then begins a countdown before fighting input is accepted.
- Round ends immediately when a player's HP hits 0.
- HP resets fully between rounds.

---

## Controls (Concept Level)

Each player has exactly **three possible inputs:**

| Input | Action |
|---|---|
| Left button | Left punch |
| Right button | Right punch |
| Both buttons simultaneously | Block |

No movement. No special moves. No combos beyond the block mechanic.

---

## Scope Constraints

- **No backend.** All state is in-memory, per session.
- **No external assets fetched at runtime** (sprites should be embedded or generated).
- **Single-page application.** No routing, no build step required — only html, css and js files.
- **No persistent storage** (no localStorage, no scores saved between sessions).

---

## Implementation Status

- Completed in code: `index.html`, `styles.css`, `main.js`.
- Player 1 is bottom, Player 2 is top and rotated 180°.
- Sprite placeholder is static; state changes only adjust CSS classes and colors.
- Ready screen overlay split per player, with P2 rotated for their POV.
- In-progress: right/left punch and block logic follow game-logic spec.