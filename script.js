// script.js
(() => {
  const stage  = document.getElementById("stage");
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const textInput = document.getElementById("textInput");

  // Switch + label
  const mouseSwitch = document.getElementById("mouseSwitch");
  const switchText  = document.getElementById("switchText");

  // Panel
  const miniPanel = document.getElementById("miniPanel");
  const collapseBtn = document.getElementById("collapseBtn");

  // Controls
  const wghtEl = document.getElementById("wght");
  const dithEl = document.getElementById("dith");
  const fsEl   = document.getElementById("fs");
  const spEl   = document.getElementById("sp");

  const wVal  = document.getElementById("wVal");
  const dVal  = document.getElementById("dVal");
  const fsVal = document.getElementById("fsVal");
  const spVal = document.getElementById("spVal");

  const lockWrapW = document.getElementById("lockWrapW");
  const lockWrapD = document.getElementById("lockWrapD");

  const status = document.getElementById("status");

  // State
  let mouseControl = true; // when ON: mouse controls weight + dither (not background)
  let weight = 500;
  let dither = 0.45;
  let sizeK  = 0.18;
  let spacing = 10;

  // Leading (line spacing) multiplier
  let leading = 1.05;

  // Pointer used only for weight/dither when mouseControl is ON
  let px = 0.5, py = 0.5;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function applyLockUI(){
    wghtEl.disabled = mouseControl;
    dithEl.disabled = mouseControl;

    lockWrapW.classList.toggle("locked", mouseControl);
    lockWrapD.classList.toggle("locked", mouseControl);

    switchText.textContent = mouseControl ? "MOUSE ON" : "MOUSE OFF";
    mouseSwitch.checked = mouseControl;
  }

  function getText(){
    return (textInput.value || "").replace(/\r\n/g,"\n");
  }

  function fitCanvas(){
    const rect = stage.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    render();
  }

  function render(){
    // UI readouts
    wVal.textContent  = String(Math.round(weight));
    dVal.textContent  = dither.toFixed(2);
    fsVal.textContent = sizeK.toFixed(3);
    spVal.textContent = String(spacing);

    const W = canvas.width, H = canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // --- Typography metrics ---
    const lines = (getText().trim() || " ").split("\n");
    const base = Math.min(W, H);
    const fontSize = Math.max(18, Math.round(base * sizeK));
    const lh = fontSize * leading;
    const blockH = (lines.length - 1) * lh;
    const startY = H * 0.5 - blockH * 0.5;

    const font = `${Math.round(weight)} ${fontSize}px "Roboto Flex", system-ui, sans-serif`;

    // --- 1) Draw uniform dot-grid background (BLACK dots on WHITE page) ---
    // Background reacts to the same "axis" feel: let dither slightly change dot radius.
    const bgStep = Math.max(5, Math.round(spacing * 0.75));
    const bgRadius = bgStep * (0.18 + dither * 0.18); // tweak for your taste
    const bgAlpha = 1.0; // bold like your reference

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.globalAlpha = bgAlpha;

    for (let y = 0; y < H; y += bgStep){
      for (let x = 0; x < W; x += bgStep){
        ctx.beginPath();
        ctx.arc(x, y, bgRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // --- 2) Punch out the text (makes the text area WHITE/empty) ---
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;

    for (let i = 0; i < lines.length; i++){
      ctx.fillText(lines[i], W * 0.5, startY + i * lh);
    }
    ctx.restore();

    // --- 3) Optional: paint white text on top for crispness (helps on some displays) ---
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;

    for (let i = 0; i < lines.length; i++){
      ctx.fillText(lines[i], W * 0.5, startY + i * lh);
    }
    ctx.restore();

    status.textContent =
      `mouse=${mouseControl ? "on" : "off"}  weight=${Math.round(weight)}  dither=${dither.toFixed(2)}  size=${sizeK.toFixed(3)}  spacing=${spacing}  leading=${leading.toFixed(2)}`;
  }

  // Text events
  textInput.addEventListener("input", render);

  // Sliders
  function syncFromSliders(){
    weight  = Number(wghtEl.value);
    dither  = Number(dithEl.value);
    sizeK   = Number(fsEl.value);
    spacing = Number(spEl.value);
    render();
  }
  [wghtEl, dithEl, fsEl, spEl].forEach(el => el.addEventListener("input", syncFromSliders));

  // Mouse: ONLY weight/dither when enabled. Background does not follow cursor.
  stage.addEventListener("pointermove", (e) => {
    if (!mouseControl) return;

    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(textInput) || path.includes(miniPanel) || path.includes(mouseSwitch)) return;

    const rect = stage.getBoundingClientRect();
    px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    py = clamp((e.clientY - rect.top)  / rect.height, 0, 1);

    const fine = e.shiftKey ? 0.25 : 1;
    const targetW = 100 + px * 900;
    const targetD = py;

    weight = weight + (targetW - weight) * (0.25 * fine);
    dither = dither + (targetD - dither) * (0.25 * fine);

    wghtEl.value = String(Math.round(weight));
    dithEl.value = String(dither.toFixed(2));

    render();
  });

  // Switch toggle (click)
  mouseSwitch.addEventListener("change", () => {
    mouseControl = mouseSwitch.checked;
    applyLockUI();
    render();
  });

  // Keyboard toggle: M always, Space only when not typing.
  function isTypingContext(){
    const el = document.activeElement;
    if (!el) return false;
    return el === textInput || el.isContentEditable;
  }

  window.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const key = e.key.toLowerCase();

    if (key === "m") {
      if (isTypingContext()) return;
      mouseControl = !mouseControl;
      applyLockUI();
      render();
      return;
    }

    if (e.code === "Space") {
      if (isTypingContext()) return;
      e.preventDefault();
      mouseControl = !mouseControl;
      applyLockUI();
      render();
    }
  });

  // Collapse (arrow only)
  collapseBtn.addEventListener("click", () => {
    miniPanel.classList.toggle("collapsed");
    collapseBtn.textContent = miniPanel.classList.contains("collapsed") ? "▸" : "▾";
  });

  window.addEventListener("resize", fitCanvas);

  // Init
  applyLockUI();
  fitCanvas();
  textInput.focus();
})();
