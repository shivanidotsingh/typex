(() => {
  const stage  = document.getElementById("stage");
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { willRead: true });

  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d", { willRead: true });

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
  let mouseControl = true;
  let weight = 500;
  let dither = 0.45;
  let sizeK  = 0.18;
  let spacing = 10;

  // Pointer (used for background + (optionally) weight/dither)
  let px = 0.5, py = 0.5;     // normalized 0..1
  let hasPointer = false;

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
    off.width = canvas.width;
    off.height = canvas.height;
    render();
  }

  function render(){
    wVal.textContent  = String(Math.round(weight));
    dVal.textContent  = dither.toFixed(2);
    fsVal.textContent = sizeK.toFixed(3);
    spVal.textContent = String(spacing);

    const W = off.width, H = off.height;

    // --- 1) build text mask (offscreen) ---
    offCtx.clearRect(0, 0, W, H);
    offCtx.save();
    offCtx.fillStyle = "#000";
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";

    const lines = (getText().trim() || " ").split("\n");
    const base = Math.min(W, H);
    const fontSize = Math.max(18, Math.round(base * sizeK));
    offCtx.font = `${Math.round(weight)} ${fontSize}px "Roboto Flex", system-ui, sans-serif`;

    const lh = fontSize * 1.05;
    const blockH = (lines.length - 1) * lh;
    const startY = H * 0.5 - blockH * 0.5;

    for (let i = 0; i < lines.length; i++){
      offCtx.fillText(lines[i], W * 0.5, startY + i * lh);
    }
    offCtx.restore();

    const textImg = offCtx.getImageData(0, 0, W, H).data;

    // --- 2) clear main canvas ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- 3) draw interactive background halftone field ---
    // Background grid spacing (independent, denser than text grid)
    const bgStep = Math.max(4, Math.round(spacing * 0.65));
    const mx = hasPointer ? px * W : W * 0.5;
    const my = hasPointer ? py * H : H * 0.5;

    // Controls the "reach" of the interaction (bigger = broader)
    const sigma = Math.min(W, H) * 0.28;
    const inv2s2 = 1 / (2 * sigma * sigma);

    // Base background dot radius (keep it subtle)
    const bgBaseR = bgStep * 0.18;

    ctx.save();
    ctx.fillStyle = "#000";

    for (let y = 0; y < H; y += bgStep) {
      for (let x = 0; x < W; x += bgStep) {

        // Soft field around mouse (Gaussian falloff)
        const dx = x - mx;
        const dy = y - my;
        const g = Math.exp(-(dx*dx + dy*dy) * inv2s2); // 0..1-ish

        // Use text mask to "knock back" background under letters
        const i = (y * W + x) * 4;
        const a = textImg[i+3] / 255; // alpha = how much text exists here
        // a=1 inside text, a=0 outside

        // Background intensity: outside text stronger, inside text weaker
        const textKnock = 1 - (a * 0.85);

        // Dot radius and opacity vary with mouse field
        const r = Math.max(0.45, bgBaseR + g * (bgStep * 0.22)) * textKnock;
        const alpha = (0.08 + g * 0.18) * textKnock; // subtle

        if (alpha < 0.01 || r < 0.2) continue;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // --- 4) draw text halftone on top (your existing system) ---
    const thresh = 0.10 + (1 - dither) * 0.35;
    const radiusBase = spacing * 0.28 * (0.35 + dither * 0.65);

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 1;

    for (let y=0; y<H; y+=spacing){
      for (let x=0; x<W; x+=spacing){
        const i = (y * W + x) * 4;
        const rC = textImg[i], gC = textImg[i+1], bC = textImg[i+2];
        const aC = textImg[i+3] / 255;

        const bright = (0.2126*rC + 0.7152*gC + 0.0722*bC) / 255;
        const ink = (1 - bright) * aC;
        if (ink < thresh) continue;

        const rad = Math.max(0.6, radiusBase * (0.25 + ink * 1.25));
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    status.textContent =
      `mouse=${mouseControl ? "on" : "off"}  weight=${Math.round(weight)}  dither=${dither.toFixed(2)}  size=${sizeK.toFixed(3)}  spacing=${spacing}`;
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

  // Pointer move:
  // - always updates pointer for background
  // - when mouseControl is ON, also controls weight + dither
  stage.addEventListener("pointermove", (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(textInput) || path.includes(miniPanel) || path.includes(mouseSwitch)) return;

    const rect = stage.getBoundingClientRect();
    px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    py = clamp((e.clientY - rect.top)  / rect.height, 0, 1);
    hasPointer = true;

    if (mouseControl) {
      const fine = e.shiftKey ? 0.25 : 1;
      const targetW = 100 + px * 900;
      const targetD = py;

      weight = weight + (targetW - weight) * (0.25 * fine);
      dither = dither + (targetD - dither) * (0.25 * fine);

      wghtEl.value = String(Math.round(weight));
      dithEl.value = String(dither.toFixed(2));
    }

    // Re-render so background follows mouse smoothly
    render();
  });

  stage.addEventListener("pointerleave", () => {
    hasPointer = false;
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
  mouseControl = true;
  applyLockUI();
  fitCanvas();
  textInput.focus();
})();
