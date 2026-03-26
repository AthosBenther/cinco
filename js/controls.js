export class Controls {
  constructor(gameState) {
    this.gameState = gameState;
    this.pressState = {
      1: { left: false, right: false },
      2: { left: false, right: false },
    };
    this.activePointers = new Map();

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

    const held = this.pressState[playerId];
    if (held.left && held.right) {
      player.enterBlock();
      return;
    }

    if (!player.blocking && !player.isAttacking) {
      player.punch(action);
    }
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
    if (player.blocking && (!this.pressState[playerId].left || !this.pressState[playerId].right)) {
      player.exitBlock();
    }
  }
}
