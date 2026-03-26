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
    this.roundWins = 0;
    this.bodyState = 'default';
    this.headState = 'default';
    this.vulnerable = false;
    this.blocking = false;
    this.isAttacking = false;
    this._hitTimer = null;

    this.spriteEl = document.getElementById(`sprite${id}`);
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
    if (this.spriteEl) {
      this.spriteEl.classList.remove('default', 'l_punch', 'r_punch', 'block', 'defeated');
      this.spriteEl.classList.add(state);
      if (state === 'default') this.spriteEl.textContent = '[SPRITE]';
    }
  }

  setVulnerable(value) {
    this.vulnerable = value;
  }

  setHeadState(state) {
    this.headState = state;
    if (this.spriteEl) {
      if (state === 'hit') {
        this.spriteEl.classList.add('hit');
      } else {
        this.spriteEl.classList.remove('hit');
      }
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
      this.hpEl.textContent = (DEBUG_SHOW_HP && this.id === 1) ? `HP: ${this.hp}` : '';
    }
    // Show P2 HP in Player 1 HUD for debug
    if (this.hp2DbgEl && this.id === 2 && DEBUG_SHOW_HP) {
      this.hp2DbgEl.textContent = `P2 HP: ${this.hp}`;
    }
    if (this.hp2DbgEl && this.id === 1) {
      // Clear for P1 instance
      this.hp2DbgEl.textContent = '';
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
      this.debugEl.textContent = `State: ${this.bodyState} | Head: ${this.headState} | Vuln: ${this.vulnerable} | Block: ${this.blocking} | Att: ${this.isAttacking}`;
    }
  }
}
