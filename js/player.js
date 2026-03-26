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
    this.roundsEl = document.getElementById(`rounds${id}`);

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
    this.bodyState = state;
    this.blocking = state === 'block';

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

  applyDamage(amount) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
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
      this.hpEl.textContent = DEBUG_SHOW_HP ? `HP: ${this.hp}` : '';
    }
    if (this.roundsEl) {
      this.roundsEl.textContent = `Round ${this.gameState.roundNumber} | Wins: ${this.roundWins}`;
    }
  }
}
