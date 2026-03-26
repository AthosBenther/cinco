export class Anim {
  constructor({ durationMs, interruptible = true, keyframes = [] }) {
    this.durationMs = durationMs;
    this.interruptible = interruptible;
    this.keyframes = keyframes
      .map((kf, idx) => ({ ...kf, atMs: kf.at * durationMs, index: idx, fired: false }))
      .sort((a, b) => a.atMs - b.atMs || a.index - b.index);
    this.playing = false;
    this._rafId = null;
    this.cancelled = false;
  }

  play(player, onComplete = () => {}) {
    if (this.playing) return;
    this.playing = true;
    this.cancelled = false;
    this.startTime = performance.now();
    this.onComplete = onComplete;
    this.keyframes.forEach((kf) => (kf.fired = false));

    const step = (time) => {
      if (!this.playing) return;

      const elapsed = time - this.startTime;
      for (const kf of this.keyframes) {
        if (!kf.fired && elapsed >= kf.atMs) {
          kf.fired = true;
          if (kf.spriteFrame != null && typeof player.setSpriteFrame === 'function') {
            player.setSpriteFrame(kf.spriteFrame);
          }
          if (kf.bodyState) {
            player.setBodyState(kf.bodyState);
          }
          if (typeof kf.onEnter === 'function') {
            kf.onEnter(player);
          }
        }
      }

      if (elapsed >= this.durationMs) {
        this.playing = false;
        this._rafId = null;
        this.onComplete({ cancelled: this.cancelled });
        return;
      }

      this._rafId = requestAnimationFrame(step);
    };

    this._rafId = requestAnimationFrame(step);
  }

  stop() {
    if (!this.playing || !this.interruptible) return;
    this.playing = false;
    this.cancelled = true;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (typeof this.onComplete === 'function') {
      this.onComplete({ cancelled: true });
    }
  }

  isPlaying() {
    return this.playing;
  }
}
