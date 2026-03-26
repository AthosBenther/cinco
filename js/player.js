import { Anim } from './anim.js';
import {
  LEFT_PUNCH_DURATION_MS,
  RIGHT_PUNCH_DURATION_MS,
  PUNCH_PHASE,
  HP_MAX,
  HIT_STATE_DURATION_MS,
  DEBUG_SHOW_HP,
} from './constants.js';

export class Player {
  constructor(id, gameState) {
    this.id = id;
    this.gameState = gameState;
    this.hp = HP_MAX;
    // Hide debug UI if not in debug mode
    if (!window.__DEBUG_ENABLED) {
      if (this.debugEl) this.debugEl.style.display = 'none';
      if (this.hp2DbgEl) this.hp2DbgEl.style.display = 'none';
      if (this.hpEl && this.id === 1) this.hpEl.style.display = 'none';
    }
    this.roundWins = 0;
    this.bodyState = 'default';
    this.headState = 'default';
    this.vulnerable = false;
    this.blocking = false;
    this.isAttacking = false;
    this._hitTimer = null;

    this.spriteCanvas = document.getElementById(`sprite${id}`);
    this.spriteCtx = this.spriteCanvas.getContext('2d');
    this.spriteImg = new window.Image();
    this.spriteImg.src = 'imgs/sprites/char.png';
    this.spriteImg.onload = () => this.drawSprite();
    this.hpEl = document.getElementById(`hp${id}`);
    this.hp2DbgEl = document.getElementById('hp2dbg');
    this.roundsEl = document.getElementById(`rounds${id}`);
    this.debugEl = document.getElementById(`debug${id}`);
    this.flagsEl = document.getElementById(`flags${id}`);
    this.roundTextEl = this.roundsEl.querySelector('.round-text');

    this.leftPunchAnim = new Anim({
      durationMs: LEFT_PUNCH_DURATION_MS,
      interruptible: false,
      keyframes: [
        { at: PUNCH_PHASE.VULNERABLE_START, onEnter: (p) => p.setVulnerable(true) },
        { at: PUNCH_PHASE.CONNECT, onEnter: (p) => p.reportHit('left') },
        {
          at: PUNCH_PHASE.RECOVER,
          onEnter: (p) => {
            p.setVulnerable(false);
            if (p.bodyState !== 'defeated') p.setBodyState('default');
          },
        },
      ],
    });

    this.rightPunchAnim = new Anim({
      durationMs: RIGHT_PUNCH_DURATION_MS,
      interruptible: false,
      keyframes: [
        { at: PUNCH_PHASE.VULNERABLE_START, onEnter: (p) => p.setVulnerable(true) },
        { at: PUNCH_PHASE.CONNECT, onEnter: (p) => p.reportHit('right') },
        {
          at: PUNCH_PHASE.RECOVER,
          onEnter: (p) => {
            p.setVulnerable(false);
            if (p.bodyState !== 'defeated') p.setBodyState('default');
          },
        },
      ],
    });

    this.updateUI();
    this.currentFrame = 0;
  }

  setHP(hp) {
    this.hp = hp;
    this.updateUI();
  }

  setBodyState(state) {
    if (this.bodyState !== state) {
      const prev = this.bodyState;
      this.bodyState = state;
      this.blocking = state === 'block';
      console.log(`Player ${this.id} state change: ${prev} → ${state}`);
    } else {
      this.bodyState = state;
      this.blocking = state === 'block';
    }
    this.currentFrame = 0;
    this.drawSprite();
  }

  setVulnerable(value) {
    this.vulnerable = value;
  }

  setHeadState(state) {
    this.headState = state;
    // Optionally: add a hit effect overlay here if desired
    this.drawSprite();
  }
  getSpriteFrameInfo() {
    // Map body state to spritesheet column
    const stateToCol = {
      'default': 0,
      'l_punch': 1,
      'r_punch': 2,
      'block': 3,
      'defeated': 4
    };
    const col = stateToCol[this.bodyState] ?? 0;
    // Only 1 frame per state for now (row 0)
    const row = 0;
    return { x: col * 10, y: row * 20, w: 10, h: 20 };
  }

  drawSprite() {
    if (!this.spriteCanvas || !this.spriteCtx || !this.spriteImg.complete) return;
    // Clear
    this.spriteCtx.clearRect(0, 0, this.spriteCanvas.width, this.spriteCanvas.height);
    // Scale up 4x (native 10x20 to 40x80)
    const scale = 4;
    const { x, y, w, h } = this.getSpriteFrameInfo();
    this.spriteCtx.imageSmoothingEnabled = false;
    this.spriteCtx.drawImage(this.spriteImg, x, y, w, h, 0, 0, w * scale, h * scale);
    // Optionally: draw hit effect overlay
    if (this.headState === 'hit') {
      this.spriteCtx.save();
      this.spriteCtx.globalCompositeOperation = 'source-atop';
      this.spriteCtx.globalAlpha = 0.5;
      this.spriteCtx.fillStyle = '#f00';
      this.spriteCtx.fillRect(0, 0, w * scale, h * scale);
      this.spriteCtx.restore();
    }
  }

  reportHit(punchType) {
    if (!this.gameState.roundActive) return;
    this.gameState.queueHit({ attacker: this, punchType });
  }

  applyDamage(amount, reason = '') {
    if (this.hp <= 0) return;
    const prevHp = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    let msg = `Player ${this.id} HP: ${prevHp} → ${this.hp}`;
    if (reason) msg += ` (${reason})`;
    console.log(msg);
    this.updateUI();
    this.triggerHitReaction();
    if (this.hp === 0 && this.bodyState !== 'defeated') {
      this.setBodyState('defeated');
      this.gameState.onPlayerDefeated(this);
    }
  }

  triggerHitReaction() {
    this.setHeadState('hit');
    if (this._hitTimer) {
      clearTimeout(this._hitTimer);
    }
    this._hitTimer = setTimeout(() => {
      this.setHeadState('default');
      this._hitTimer = null;
    }, HIT_STATE_DURATION_MS);
  }

  punch(type) {
    if (!this.gameState.roundActive || this.bodyState === 'defeated' || this.blocking || this.isAttacking) return;

    this.isAttacking = true;
    this.setBodyState(type === 'left' ? 'l_punch' : 'r_punch');

    const anim = type === 'left' ? this.leftPunchAnim : this.rightPunchAnim;
    anim.play(this, ({ cancelled }) => {
      this.isAttacking = false;
      if (!cancelled && this.bodyState !== 'defeated' && !this.blocking) {
        this.setBodyState('default');
      }
    });
  }

  enterBlock() {
    if (this.bodyState === 'default' && !this.isAttacking && this.hp > 0) {
      this.setBodyState('block');
    }
  }

  exitBlock() {
    if (this.bodyState === 'block') {
      this.setBodyState('default');
      this.blocking = false;
    }
  }

  resetRound() {
    this.hp = HP_MAX;
    this.vulnerable = false;
    this.blocking = false;
    this.isAttacking = false;
    this.setBodyState('default');
    this.setHeadState('default');
    if (this._hitTimer) {
      clearTimeout(this._hitTimer);
      this._hitTimer = null;
    }
    this.updateUI();
  }

  updateUI() {
    if (this.hpEl) {
      if (window.__DEBUG_ENABLED && this.id === 1) {
        this.hpEl.style.display = '';
        this.hpEl.textContent = `HP: ${this.hp}`;
      } else {
        this.hpEl.style.display = 'none';
      }
    }
    if (this.hp2DbgEl) {
      if (window.__DEBUG_ENABLED && this.id === 2) {
        this.hp2DbgEl.style.display = '';
        this.hp2DbgEl.textContent = `P2 HP: ${this.hp}`;
      } else {
        this.hp2DbgEl.style.display = 'none';
        if (this.id === 1) this.hp2DbgEl.textContent = '';
      }
    }
    if (this.roundTextEl) {
      this.roundTextEl.textContent = `Round ${this.gameState.roundNumber}`;
    }
    if (this.flagsEl) {
      this.flagsEl.innerHTML = '';
      for (let i = 0; i < this.roundWins; i++) {
        const flag = document.createElement('div');
        flag.className = 'flag';
        this.flagsEl.appendChild(flag);
      }
    }
    if (this.debugEl) {
      if (window.__DEBUG_ENABLED) {
        this.debugEl.style.display = '';
        this.debugEl.textContent = `State: ${this.bodyState} | Head: ${this.headState} | Vuln: ${this.vulnerable} | Block: ${this.blocking} | Att: ${this.isAttacking}`;
      } else {
        this.debugEl.style.display = 'none';
      }
    }
    this.drawSprite();
  }
}
