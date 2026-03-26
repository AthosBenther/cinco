# Thumb Fighter — Game Logic

## Tunable Constants

All values below should be defined as named constants at the top of the game logic module so they can be adjusted without hunting through code.

```js
const TOTAL_ANIM_DURATION_MS = 1000; // Base duration for one full punch animation cycle

const PUNCH_PHASE = {
  VULNERABLE_START: 0.3,  // Fraction of cycle at which attacker becomes vulnerable
  CONNECT:          0.5,  // Fraction of cycle at which hit is evaluated
  RECOVER:          0.7,  // Fraction of cycle at which attacker returns to default
};

const LEFT_PUNCH_DURATION_MS  = TOTAL_ANIM_DURATION_MS * 0.8; // Faster
const RIGHT_PUNCH_DURATION_MS = TOTAL_ANIM_DURATION_MS * 1.2; // Slower

const RIGHT_PUNCH_MULTIPLIER = 2;

const HP_MAX = 10;

const HIT_STATE_DURATION_MS = 300; // How long head stays in `hit` state

const ROUND_END_PAUSE_MS = 2000;   // Pause after round before Ready Screen
const ROUNDS_TO_WIN_MATCH = 2;     // First to this many round wins takes the match
```

---

## Class Responsibilities

Before the implementation details, a map of what each class owns. Nothing should reach outside its lane.

| Class | Owns | Does NOT own |
|---|---|---|
| `Anim` | Timeline, keyframe firing, sprite frame, body state changes | Damage math, opponent references, game rules |
| `Player` | HP, body state, head state, vulnerability flag, per-player anims | Damage resolution, match flow, opponent references |
| `Controls` | Touch input mapping, translating input events into `Player` method calls | Any game logic |
| `GameState` | Damage resolution, simultaneous hit handling, round/match flow, win conditions | Rendering, input |

The call chain for a punch:

```
Controls.onInput(LEFT_PUNCH)
  └──► Player.punch('left')
         └──► plays leftPunchAnim
                └──► keyframe: VULNERABLE_START → Player.setVulnerable(true)
                └──► keyframe: CONNECT → Player.reportHit(punchType)
                                           └──► GameState.resolveHit(attacker, punchType)
                                                  └──► calculates damage from defender state
                                                  └──► defender.applyDamage(amount)
                                                  └──► defender.triggerHitReaction()
                └──► keyframe: RECOVER → Player.setVulnerable(false) + bodyState = 'default'
```

`GameState.resolveHit()` is the single point where damage math happens. It reads the defender's current state at the moment of the call — it does not need to be scheduled or predicted ahead of time.

---

## Anim Class

`Anim` is a dumb timeline driver. It knows nothing about game rules. Its only jobs are: advance time, fire keyframes at the right moment, update sprite frame and body state when told to.

### Construction

```js
const anim = new Anim({
  durationMs:    1000,        // Total animation duration in ms
  interruptible: true,        // Whether caller may stop() this mid-play
  keyframes: [
    {
      at:          0.3,       // Fractional position (0.0–1.0); atMs derived as at * durationMs
      spriteFrame: 2,         // Sprite sheet frame index to switch to (optional)
      bodyState:   'l_punch', // Player body state to set (optional)
      onEnter:     (player) => { /* side-effect: called once when keyframe is crossed */ },
    },
    // ...
  ],
});
```

### Keyframe Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `at` | `number` (0.0–1.0) | Yes | Fractional position in the timeline |
| `atMs` | `number` | Derived | `at * durationMs` — computed on construction |
| `spriteFrame` | `number` | No | Sprite sheet frame index to activate |
| `bodyState` | `string` | No | Player body state to set |
| `onEnter` | `fn(player)` | No | Fired once when the keyframe is crossed. Use for anything `Anim` doesn't natively support: vulnerability flags, hit reporting, sound, effects. |

### Methods

| Method | Description |
|---|---|
| `play(player, onComplete)` | Starts playback bound to `player`. Fires keyframes in `at` order. Calls `onComplete({ cancelled })` when done or stopped. |
| `stop()` | Halts if `interruptible: true`, silent no-op otherwise. `onComplete` still fires with `cancelled: true`. |
| `isPlaying()` | Returns `true` if currently running. |

### Behaviour Rules

- Keyframes at the same `at` value fire in declaration order.
- `onComplete` always fires, even on cancellation — callers should not rely on it only for the happy path.
- `Anim` does not hold a reference to the opponent or `GameState`. Any cross-object logic goes in `onEnter` callbacks, which are wired by `Player` at instantiation time.

### Punch Anim Example

```js
// Defined once on Player, reused every round
this.leftPunchAnim = new Anim({
  durationMs:    LEFT_PUNCH_DURATION_MS,
  interruptible: false,
  keyframes: [
    { at: PUNCH_PHASE.VULNERABLE_START, bodyState: 'l_punch', onEnter: (p) => p.setVulnerable(true)       },
    { at: PUNCH_PHASE.CONNECT,          spriteFrame: 3,        onEnter: (p) => p.reportHit('left')         },
    { at: PUNCH_PHASE.RECOVER,          bodyState: 'default',  onEnter: (p) => p.setVulnerable(false)      },
  ],
});
```

`p.reportHit('left')` calls up to `GameState` — `Anim` itself never touches damage logic.

---

## Punch Timing Phases

Each punch runs through four phases, calculated from its own duration:

| Phase | Trigger Point | Player State |
|---|---|---|
| **Windup** | `0` → `VULNERABLE_START` | `l_punch` / `r_punch` (not yet vulnerable) |
| **Vulnerable** | `VULNERABLE_START` → `CONNECT` | Attacker can be hit for bonus damage |
| **Connect** | At `CONNECT` | Hit evaluation runs (see Damage Resolution) |
| **Recovery** | `CONNECT` → `RECOVER` | Attacker still in punch state |
| **Default** | After `RECOVER` | Returns to `default` body state |

A new punch input received while already in a punch animation is **ignored** until the current animation completes recovery.

---

## Block Timing

- Block activates **immediately** when both punch buttons are held simultaneously.
- Block drops **immediately** when either button is released.
- A player cannot initiate a punch while in block state — input is ignored.
- A player already mid-punch when the opponent's connect frame arrives is treated as **not blocking** for that hit.

---

## Damage Resolution

Damage is evaluated at the **attacker's connect frame** (`CONNECT` phase of the punch timeline).

### Hit Conditions & Base Damage

| Defender State at Connect Frame | Base Damage |
|---|---|
| `block` (guard fully up) | 1 |
| `default` (idle / recovering) | 2 |
| Vulnerable (mid-punch, between `VULNERABLE_START` and `RECOVER`) | 3 |

### Right Punch Multiplier

Right punches apply `RIGHT_PUNCH_MULTIPLIER` to the base damage:

| Defender State | Left Punch | Right Punch |
|---|---|---|
| Blocking | 1 | 2 |
| Default | 2 | 4 |
| Vulnerable | 3 | 6 |

### Simultaneous Connect Resolution

If both players' connect frames occur on the same frame (or within the same game tick):

- **Both players take damage independently.** Each evaluates the opponent's state at that moment.
- No cancellation, no priority. Both damage values are applied before any state updates for that tick.

---

## HP & Defeat

- HP is an integer, minimum 0, maximum `HP_MAX`.
- HP never goes below 0.
- When HP reaches 0, the player's body state transitions to `defeated` immediately.
- The round ends on the same frame HP hits 0. No further input is processed.
- HP resets to `HP_MAX` at the start of each round.

---

## Player State Machine

### Body States

```
default ──────────────────────────────────────────────┐
  │                                                    │
  ├─[left punch input]──► l_punch ──[recover done]────►┤
  │                                                    │
  ├─[right punch input]─► r_punch ──[recover done]────►┤
  │                                                    │
  ├─[both buttons held]─► block ──[button released]───►┤
  │                                                    │
  └─[HP = 0]───────────► defeated (until round reset) ─┘
```

- `defeated` is a terminal state within the round. No inputs are accepted.
- Punch inputs are ignored during `block` and `defeated`.
- Block input is ignored during any punch animation.

### Head States

```
default ──[hit received]──► hit ──[HIT_STATE_DURATION_MS elapsed]──► default
```

- Head state is independent of body state.
- A second hit received while already in `hit` state restarts the `HIT_STATE_DURATION_MS` timer.

---

## Round & Match Flow

```
Match Start
  └──► Round Start
         └──► [Both players touch Ready]
                └──► Countdown (3-2-1-FIGHT)
                       └──► Round Active (input accepted)
                              └──► [Player HP = 0]
                                     └──► Round End
                                            ├── [Winner's round count < ROUNDS_TO_WIN_MATCH]
                                            │     └──► ROUND_END_PAUSE_MS pause ──► Round Start
                                            └── [Winner's round count = ROUNDS_TO_WIN_MATCH]
                                                  └──► Match End Screen
                                                         └──► [Restart] ──► Match Start
```
### Implementation Notes

- Ready screen and countdown as specified in UI are implemented in `main.js`.
- Both player inputs are handled by the `Controls` class with touch pointer tracking.
- `GameState.resolveHit` is done in `processHitQueue` and supports simultaneous connects.
- Block state interrupts and punch vulnerability windows are fully active.
- `HP_MAX`, `ROUND_END_PAUSE_MS`, `ROUNDS_TO_WIN_MATCH` set to spec values.
### Round Win Tracking

- Each player has a `roundWins` counter, reset only on full match restart.
- Round win is awarded to the player whose opponent reached 0 HP.
- If both players somehow reach 0 HP on the same tick (simultaneous final hit), award the round win to both — match win condition then requires one player to be strictly ahead. If still tied at match end, play a tiebreaker round.

---

## Input Handling Notes

- Multi-touch must track individual touch identifiers to distinguish left/right button presses per player.
- A "both buttons held" block state requires both touches to be **active simultaneously** — sequential taps do not trigger block.
- Touch input should be debounced at the game tick level, not the DOM event level, to avoid ghost inputs from palm contact.