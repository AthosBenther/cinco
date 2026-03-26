# Changes Applied

- Fixed player-area positioning to match design:
  - `player1` is now at bottom half (`bottom: 0`) with upright orientation.
  - `player2` is now at top half (`top: 0`) and rotated 180°.

- Removed active sprite translation/animation from style classes:
  - `.sprite` no longer has `transition` or transform translation in punch states.
  - `l_punch`, `r_punch`, `block`, `defeated` now only use color cues.

- Updated ready screen overlay to be split into per-player halves:
  - Each half is aligned with respective player orientation.
  - `p2` half is rotated 180° so P2 sees upright text from their side.
  - `p1` half remains upright for P1 control.

- Injection into `main.js`:
  - `showReadyScreen` now renders `overlay-ready` with .ready-half for P2 and P1.
  - Ready buttons maintain same id logic, now per-half.

- Kept countdown / round-end / match-end overlays centralized.

- Added this `changes.md` document as requested.
