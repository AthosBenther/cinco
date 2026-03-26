import { Player } from './player.js';
import { Controls } from './controls.js';
import {
  ROUNDS_TO_WIN_MATCH,
  ROUND_END_PAUSE_MS,
  RIGHT_PUNCH_MULTIPLIER,
} from './constants.js';

export class GameState {
  constructor() {
    this.players = { 1: new Player(1, this), 2: new Player(2, this) };
    this.roundNumber = 1;
    this.pendingHits = [];
    this.roundActive = false;
    this.isPortrait = true;
    this.readyStatus = { 1: false, 2: false };
    this.overlay = document.getElementById('overlay');
    this.rotateOverlay = document.getElementById('rotateOverlay');
    this.controls = new Controls(this);
    this.loopId = null;
    this.matchEnded = false;

    this.detectOrientation();
    window.addEventListener('resize', () => this.detectOrientation());
    this.startMatch();
    this.loop();
  }

  detectOrientation() {
    this.isPortrait = window.innerHeight >= window.innerWidth;
    if (!this.isPortrait) {
      this.rotateOverlay.classList.remove('hidden');
      this.roundActive = false;
    } else {
      this.rotateOverlay.classList.add('hidden');
    }
  }

  loop() {
    if (this.isPortrait && this.roundActive) {
      this.processHitQueue();
    }

    this.loopId = requestAnimationFrame(() => this.loop());
  }

  startMatch() {
    this.roundNumber = 1;
    this.players[1].roundWins = 0;
    this.players[2].roundWins = 0;
    this.players[1].resetRound();
    this.players[2].resetRound();
    this.matchEnded = false;
    this.showReadyScreen();
  }

  startRound() {
    this.players[1].resetRound();
    this.players[2].resetRound();
    this.readyStatus = { 1: false, 2: false };
    this.roundActive = false;
    this.showReadyScreen();
  }

  showReadyScreen() {
    this.setOverlayHTML(`
      <div class="overlay-ready">
        <div class="ready-half p2">
          <div class="overlay-content">
            <div class="round-result">P2</div>
            <div class="round-result">Round ${this.roundNumber}</div>
            <div class="round-result">Score P1 ${this.players[1].roundWins} - P2 ${this.players[2].roundWins}</div>
            <button class="ready-btn" data-player="2">${this.readyStatus[2] ? '✓ Ready' : 'Ready'}</button>
          </div>
        </div>
        <div class="ready-half p1">
          <div class="overlay-content">
            <div class="round-result">P1</div>
            <div class="round-result">Round ${this.roundNumber}</div>
            <div class="round-result">Score P1 ${this.players[1].roundWins} - P2 ${this.players[2].roundWins}</div>
            <button class="ready-btn" data-player="1">${this.readyStatus[1] ? '✓ Ready' : 'Ready'}</button>
          </div>
        </div>
      </div>
    `);

    this.overlay.classList.remove('hidden');
    this.overlay.onclick = (event) => {
      const btn = event.target.closest('.ready-btn');
      if (!btn) return;
      const playerId = Number(btn.dataset.player);
      if (![1, 2].includes(playerId)) return;
      this.readyStatus[playerId] = true;
      this.showReadyScreen();

      if (this.readyStatus[1] && this.readyStatus[2]) {
        this.startCountdown();
      }
    };
  }

  startCountdown() {
    let value = 3;
    this.overlay.classList.remove('hidden');
    this.roundActive = false;
    this.overlay.onclick = null;

    const tick = () => {
      if (value > 0) {
        this.setOverlayHTML(`<div class="overlay-content"><div class="countdown-text">${value}</div></div>`);
        value -= 1;
        setTimeout(tick, 1000);
      } else {
        this.setOverlayHTML(`<div class="overlay-content"><div class="countdown-text">FIGHT!</div></div>`);
        setTimeout(() => {
          this.overlay.classList.add('hidden');
          this.roundActive = true;
          this.players[1].updateUI();
          this.players[2].updateUI();
        }, 700);
      }
    };

    tick();
  }

  setOverlayHTML(html) {
    if (this.overlay) this.overlay.innerHTML = html;
  }

  queueHit({ attacker, punchType }) {
    if (!this.roundActive) return;
    this.pendingHits.push({ attacker, punchType, defender: this.getOpponent(attacker) });
  }

  getOpponent(player) {
    return player.id === 1 ? this.players[2] : this.players[1];
  }

  processHitQueue() {
    if (this.pendingHits.length === 0 || !this.roundActive) return;

    const hits = this.pendingHits.splice(0, this.pendingHits.length);
    const evaluations = hits.map((hit) => {
      const defender = hit.defender;
      let base = 2;
      if (defender.bodyState === 'block') {
        base = 1;
      } else if (defender.vulnerable) {
        base = 3;
      }
      const damage = hit.punchType === 'right' ? base * RIGHT_PUNCH_MULTIPLIER : base;
      return { hit, damage };
    });

    evaluations.forEach(({ hit, damage }) => {
      hit.defender.applyDamage(damage);
    });

    const p1Dead = this.players[1].hp <= 0;
    const p2Dead = this.players[2].hp <= 0;
    if (p1Dead || p2Dead) {
      let winner = null;
      if (p1Dead && p2Dead) {
        winner = null;
      } else if (p1Dead) {
        winner = this.players[2];
      } else if (p2Dead) {
        winner = this.players[1];
      }
      this.endRound(winner);
    }
  }

  onPlayerDefeated(defeatedPlayer) {
    if (!this.roundActive) return;
    const winner = this.getOpponent(defeatedPlayer);
    this.endRound(winner);
  }

  endRound(winner) {
    if (!this.roundActive) return;
    this.roundActive = false;
    this.pendingHits = [];

    if (winner) {
      winner.roundWins += 1;
    }

    let message = 'DRAW! Both knocked out.';
    if (winner) {
      message = `PLAYER ${winner.id} WINS ROUND ${this.roundNumber}`;
    }

    this.setOverlayHTML(`<div class="overlay-content"><div class="round-result">${message}</div></div>`);
    this.overlay.classList.remove('hidden');

    setTimeout(() => {
      if (winner && winner.roundWins >= ROUNDS_TO_WIN_MATCH) {
        this.matchEnd(winner);
      } else {
        this.roundNumber += 1;
        this.players[1].updateUI();
        this.players[2].updateUI();
        this.startRound();
      }
    }, ROUND_END_PAUSE_MS);
  }

  matchEnd(winner) {
    this.matchEnded = true;
    this.roundActive = false;
    this.setOverlayHTML(`
      <div class="overlay-content">
        <div class="match-result">PLAYER ${winner.id} WINS THE MATCH!</div>
        <button class="ready-btn" id="matchRestart">Restart Match</button>
      </div>
    `);
    this.overlay.classList.remove('hidden');
    const restart = document.getElementById('matchRestart');
    if (restart) {
      restart.onclick = () => this.startMatch();
    }
  }
}
