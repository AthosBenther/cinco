// Show block button on desktop, simulate L+R press/release
function isDesktop() {
  return !('ontouchstart' in window) && !navigator.userAgent.match(/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i);
}
if (isDesktop()) {
  [1,2].forEach(pid => {
    const blockBtn = document.querySelector(`#controls${pid} .punch-btn.block`);
    if (blockBtn) blockBtn.style.display = '';
    // Simulate L+R press/release
    blockBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      ['left','right'].forEach(action => {
        const btn = document.querySelector(`#controls${pid} .punch-btn.${action}`);
        if (btn) {
          const evt = new PointerEvent('pointerdown', { bubbles:true, pointerId:100+pid, pointerType:'mouse' });
          btn.dispatchEvent(evt);
        }
      });
    });
    blockBtn.addEventListener('mouseup', e => {
      e.preventDefault();
      ['left','right'].forEach(action => {
        const btn = document.querySelector(`#controls${pid} .punch-btn.${action}`);
        if (btn) {
          const evt = new PointerEvent('pointerup', { bubbles:true, pointerId:100+pid, pointerType:'mouse' });
          btn.dispatchEvent(evt);
        }
      });
    });
    blockBtn.addEventListener('mouseleave', e => {
      // Safety: release if mouse leaves
      ['left','right'].forEach(action => {
        const btn = document.querySelector(`#controls${pid} .punch-btn.${action}`);
        if (btn) {
          const evt = new PointerEvent('pointerup', { bubbles:true, pointerId:100+pid, pointerType:'mouse' });
          btn.dispatchEvent(evt);
        }
      });
    });
  });
}