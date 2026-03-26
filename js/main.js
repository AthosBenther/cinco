
import { GameState } from './game-state.js';

// Parse URL params
function getUrlParams() {
  const params = {};
  window.location.search.replace(/[?&]([^=]+)=([^&]*)/g, (_, k, v) => { params[k] = v; });
  return params;
}
const urlParams = getUrlParams();
window.__DEBUG_ENABLED = urlParams.debug === 'true';
window.__FIGHT_MODE = urlParams.fight === 'true';


// Track which keys are down to avoid duplicate pointerdown events
const keyToBtn = {
  'q': { player: 2, action: 'right' },
  'e': { player: 2, action: 'left' },
  'a': { player: 1, action: 'left' },
  'd': { player: 1, action: 'right' }
};
const keyDownState = {};
function simulateButtonDown(player, action) {
  const btn = document.querySelector(`.punch-btn[data-player="${player}"][data-action="${action}"]`);
  if (!btn) return;
  const downEvt = new PointerEvent('pointerdown', { bubbles:true, pointerId:200+player, pointerType:'mouse' });
  btn.dispatchEvent(downEvt);
}
function simulateButtonUp(player, action) {
  const btn = document.querySelector(`.punch-btn[data-player="${player}"][data-action="${action}"]`);
  if (!btn) return;
  const upEvt = new PointerEvent('pointerup', { bubbles:true, pointerId:200+player, pointerType:'mouse' });
  btn.dispatchEvent(upEvt);
}

window.addEventListener('DOMContentLoaded', () => {
  new GameState({ debug: window.__DEBUG_ENABLED, fight: window.__FIGHT_MODE });
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.repeat || !(key in keyToBtn)) return;
    if (keyDownState[key]) return; // already down
    keyDownState[key] = true;
    const { player, action } = keyToBtn[key];
    simulateButtonDown(player, action);
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (!(key in keyToBtn)) return;
    if (!keyDownState[key]) return;
    keyDownState[key] = false;
    const { player, action } = keyToBtn[key];
    simulateButtonUp(player, action);
  });
});
