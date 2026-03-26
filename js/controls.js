export class Controls {
  constructor(gameState) {
    this.gameState = gameState;
    this.pressState = {
      1: { left: false, right: false },
      2: { left: false, right: false },
    };
    this.activePointers = new Map();
    // Track if a punch release should be suppressed after block for each player/button
    this.suppressPunchOnRelease = {
      1: { left: false, right: false },
      2: { left: false, right: false },
    };
    // Track if player was hit while blocking, to suppress punch on both buttons
    this.suppressAllPunchOnRelease = {
      1: false,
      2: false
    };
    // Listen for custom event from game-state when a player is hit while blocking
    window.addEventListener('player-block-hit', (e) => {
      const pid = e.detail.playerId;
      this.suppressAllPunchOnRelease[pid] = true;
    });
    this.init();
  }

  init() {
    const buttons = document.querySelectorAll('.punch-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => this.onPointerDown(e, btn));
      btn.addEventListener('pointerup', (e) => this.onPointerUp(e, btn));
      btn.addEventListener('pointercancel', (e) => this.onPointerUp(e, btn));
      btn.addEventListener('pointerleave', (e) => this.onPointerUp(e, btn));
    });

    window.addEventListener('pointerup', () => {
      Object.keys(this.pressState).forEach((pid) => {
        this.pressState[pid].left = false;
        this.pressState[pid].right = false;
      });
      buttons.forEach((btn) => btn.classList.remove('active'));
      this.gameState.players[1].exitBlock();
      this.gameState.players[2].exitBlock();
    });
  }

  onPointerDown(event, btn) {
    event.preventDefault();
    if (!this.gameState.roundActive || !this.gameState.isPortrait) return;

    const playerId = Number(btn.dataset.player);
    const action = btn.dataset.action;
    if (![1, 2].includes(playerId) || !['left', 'right'].includes(action)) return;

    this.pressState[playerId][action] = true;
    btn.classList.add('active');
    this.activePointers.set(event.pointerId, { playerId, action });

    const player = this.gameState.players[playerId];
    if (player.bodyState === 'defeated' || player.hp <= 0) return;

    // Block triggers as soon as both buttons are pressed
    const held = this.pressState[playerId];
    if (held.left && held.right) {
      player.enterBlock();
    }
    // Do NOT punch here; punch is now on release
  }

  onPointerUp(event, btn) {
    event.preventDefault();
    const pointer = this.activePointers.get(event.pointerId);
    if (!pointer) return;

    const { playerId, action } = pointer;
    this.pressState[playerId][action] = false;
    btn.classList.remove('active');
    this.activePointers.delete(event.pointerId);

    const player = this.gameState.players[playerId];
    // If block was active and either button is released, exit block
    let exitedBlock = false;
    if (player.blocking && (!this.pressState[playerId].left || !this.pressState[playerId].right)) {
      player.exitBlock();
      exitedBlock = true;
    }
    // If we just exited block, suppress punch for this button
    if (exitedBlock) {
      this.suppressPunchOnRelease[playerId][action] = true;
    }
    // If player was hit while blocking, suppress punch for both buttons until both are released
    if (this.suppressAllPunchOnRelease[playerId]) {
      if (!this.pressState[playerId].left && !this.pressState[playerId].right) {
        this.suppressAllPunchOnRelease[playerId] = false;
      }
      return;
    }
    // Punch triggers on button release, but only if not blocking and not defeated
    if (!player.blocking && !player.isAttacking && player.bodyState !== 'defeated' && player.hp > 0) {
      if (this.suppressPunchOnRelease[playerId][action]) {
        this.suppressPunchOnRelease[playerId][action] = false;
        return;
      }
      player.punch(action);
    }
  }
}
