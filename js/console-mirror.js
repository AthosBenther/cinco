// Console mirror utility
(function() {
  const mirror = document.getElementById('consoleMirror');
  const wrap = document.getElementById('consoleMirrorWrap');
  const copyBtn = document.getElementById('copyConsoleBtn');
  if (!mirror || !wrap || !copyBtn) return;
  // Make wrap click-through except for textarea and button
  wrap.style.pointerEvents = 'none';
  mirror.style.pointerEvents = 'none';
  copyBtn.style.pointerEvents = 'auto';
  // Copy button logic
  copyBtn.onclick = function(e) {
    e.stopPropagation();
    mirror.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
  };
  const origLog = console.log;
  function appendToMirror(...args) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    mirror.value += (mirror.value.endsWith('\n') ? '' : '\n') + msg + '\n';
    mirror.scrollTop = mirror.scrollHeight;
  }
  console.log = function(...args) {
    origLog.apply(console, args);
    appendToMirror(...args);
  };
  ['warn','error'].forEach(fn => {
    const orig = console[fn];
    console[fn] = function(...args) {
      orig.apply(console, args);
      appendToMirror('[console.'+fn+']', ...args);
    };
  });
})();