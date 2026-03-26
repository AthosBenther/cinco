import { Player } from './player.js';
import { Controls } from './controls.js';
import {
  ROUNDS_TO_WIN_MATCH,
  ROUND_END_PAUSE_MS,
  RIGHT_PUNCH_MULTIPLIER,
} from './constants.js';

export class GameState {
  constructor(opts = {}) {
    this.debug = !!opts.debug;
    this.fightMode = !!opts.fight;
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
    if (this.fightMode) {
      // Skip menu/ready/countdown, start fight with 1000 HP
      this.roundNumber = 1;
      this.players[1].roundWins = 0;
      this.players[2].roundWins = 0;
      this.players[1].setHP(1000);
      this.players[2].setHP(1000);
      this.matchEnded = false;
      this.overlay.classList.add('hidden');
      this.roundActive = true;
      this.players[1].updateUI();
      this.players[2].updateUI();
    } else {
      this.showMainMenu();
    }
    this.loop();
  }

  // Allow setting HP directly for fight mode
  setPlayerHP(playerId, hp) {
    if (this.players[playerId]) {
      this.players[playerId].setHP(hp);
      this.players[playerId].updateUI();
    }
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

  showMainMenu() {
    this.setOverlayHTML(`
      <div class="overlay-content">
        <div class="menu-title">Thumb Fighter</div>
        <button class="menu-btn" id="fullscreenBtn">Enter Fullscreen</button>
        <button class="menu-btn" id="startBtn">Start Game</button>
      </div>
    `);
    this.overlay.classList.remove('hidden');

    document.getElementById('fullscreenBtn').onclick = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    };

    document.getElementById('startBtn').onclick = () => {
      this.overlay.classList.add('hidden');
      this.startMatch();
    };
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
      // Defensive snapshot: check block state at hit time
      const wasBlocking = defender.bodyState === 'block';
      let base = 2;
      let reason = 'default';
      if (wasBlocking) {
        base = 1;
        reason = 'block';
      } else if (defender.vulnerable) {
        base = 3;
        reason = 'vulnerable';
      }
      const damage = hit.punchType === 'right' ? base * RIGHT_PUNCH_MULTIPLIER : base;
      const punchType = hit.punchType;
      return { hit, damage, reason: `${punchType} punch, ${reason}`, wasBlocking };
    });

    evaluations.forEach(({ hit, damage, reason, wasBlocking }) => {
      hit.defender.applyDamage(damage, reason);
      // If defender was blocking and took a hit, notify controls to suppress punch on release
      if (wasBlocking && damage > 0) {
        window.dispatchEvent(new CustomEvent('player-block-hit', { detail: { playerId: hit.defender.id } }));
      }
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
        <button class="menu-btn" id="matchRestart">Play Again</button>
        <button class="menu-btn" id="mainMenu">Main Menu</button>
      </div>
    `);
    this.overlay.classList.remove('hidden');
    document.getElementById('matchRestart').onclick = () => this.startMatch();
    document.getElementById('mainMenu').onclick = () => this.showMainMenu();
  }
}
