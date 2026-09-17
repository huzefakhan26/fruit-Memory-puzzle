/* =============================================================
   Fruit Memory AI Puzzle — script.js
   ============================================================= */

const FRUITS = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🍑", "🍍", "🥝", "🍋", "🍊"];

let currentUser  = null;
let currentLevel = 1;
let levelsData   = [];

/* ── Speech ──────────────────────────────────────────────────── */
function speak(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u  = new SpeechSynthesisUtterance(text);
    u.pitch  = 1.4;
    u.rate   = 1.02;
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech errors must never crash the game */ }
}

/* ── Screen switching ────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/* ── Floating fruit background ───────────────────────────────── */
function startFruitBackground() {
  const layer = document.getElementById("fruit-bg");
  if (!layer) return;
  setInterval(() => {
    const span          = document.createElement("span");
    span.className      = "floating-fruit";
    span.textContent    = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    span.style.left     = Math.random() * 96 + "vw";
    const dur           = 9 + Math.random() * 8;
    span.style.animationDuration = dur + "s";
    span.style.fontSize = (1.6 + Math.random() * 1.8) + "rem";
    layer.appendChild(span);
    setTimeout(() => span.remove(), dur * 1000 + 200);
  }, 700);
}

/* ── Auth overlay ────────────────────────────────────────────── */
function openAuth() {
  document.getElementById("auth-overlay").classList.add("active");
  showAuthPanel("signup");
}
function closeAuth() {
  document.getElementById("auth-overlay").classList.remove("active");
}
function showAuthPanel(which) {
  document.getElementById("panel-signup").classList.toggle("hidden", which !== "signup");
  document.getElementById("panel-signin").classList.toggle("hidden", which !== "signin");
}

/* ── Sign Up ─────────────────────────────────────────────────── */
async function doSignup() {
  const name     = document.getElementById("su-name").value.trim();
  const user_id  = document.getElementById("su-userid").value.trim();
  const password = document.getElementById("su-password").value;
  const msg      = document.getElementById("su-msg");

  if (!name || !user_id || !password) {
    msg.textContent = "Please fill in every field.";
    msg.classList.remove("ok");
    return;
  }

  try {
    const res  = await fetch("/api/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, user_id, password }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.classList.toggle("ok", !!data.ok);
    if (data.ok) {
      document.getElementById("su-name").value     = "";
      document.getElementById("su-userid").value   = "";
      document.getElementById("su-password").value = "";
      document.getElementById("si-userid").value   = user_id;
      document.getElementById("si-msg").textContent = "Account created! Now sign in.";
      document.getElementById("si-msg").classList.add("ok");
      showAuthPanel("signin");
      document.getElementById("si-password").focus();
    }
  } catch (err) {
    msg.textContent = "Network error. Please try again.";
    msg.classList.remove("ok");
  }
}

/* ── Sign In ─────────────────────────────────────────────────── */
async function doSignin() {
  const user_id  = document.getElementById("si-userid").value.trim();
  const password = document.getElementById("si-password").value;
  const msg      = document.getElementById("si-msg");

  if (!user_id || !password) {
    msg.textContent = "Please enter User ID and password.";
    msg.classList.remove("ok");
    return;
  }

  try {
    const res  = await fetch("/api/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ user_id, password }),
    });
    const data = await res.json();
    if (!data.ok) {
      msg.textContent = data.message;
      msg.classList.remove("ok");
      return;
    }
    currentUser = { user_id: data.user_id, name: data.name };
    document.getElementById("player-name-tag").textContent = "🐾 " + data.name;
    closeAuth();
    await goToLevelScreen();
  } catch (err) {
    msg.textContent = "Network error. Please try again.";
    msg.classList.remove("ok");
  }
}

/* ── Logout ──────────────────────────────────────────────────── */
async function doLogout() {
  try { await fetch("/api/logout", { method: "POST" }); } catch (e) {}
  currentUser = null;
  levelsData  = [];
  showScreen("screen-welcome");
  speak("Welcome! Let's play puzzle!");
}

/* ── Level screen ────────────────────────────────────────────── */
async function goToLevelScreen() {
  showScreen("screen-levels");
  speak("Select your level!");
  await loadProgress();
  renderTrainTrack();
}

async function loadProgress() {
  try {
    const res  = await fetch("/api/progress");
    const data = await res.json();
    if (data.ok) levelsData = data.levels;
  } catch (e) {
    console.error("Could not load progress:", e);
  }
}

/* ── Board size per level ────────────────────────────────────── */
function boardSizeForLevel(level) {
  // Always returns an even total so pairs work correctly.
  // Level 1-2 : 4×4 (8 pairs)
  // Level 3-4 : 4×6 (12 pairs)
  // Level 5-6 : 6×6 (18 pairs)
  // Level 7-8 : 6×8 (24 pairs)
  // Level 9-10: 8×8 (32 pairs) – capped so we don't exceed FRUITS pool × 3
  const sizes = [
    { rows: 4, cols: 4 },   // 1
    { rows: 4, cols: 4 },   // 2
    { rows: 4, cols: 6 },   // 3
    { rows: 4, cols: 6 },   // 4
    { rows: 6, cols: 6 },   // 5
    { rows: 6, cols: 6 },   // 6
    { rows: 6, cols: 8 },   // 7
    { rows: 6, cols: 8 },   // 8
    { rows: 8, cols: 8 },   // 9
    { rows: 8, cols: 8 },   // 10
  ];
  const idx = Math.min(level - 1, sizes.length - 1);
  return sizes[idx];
}

/* ── Train track (level map) ─────────────────────────────────── */
function renderTrainTrack(justUnlockedLevel = null) {
  const track = document.getElementById("train-track");
  if (!track) return;
  track.innerHTML = "";

  const engine       = document.createElement("div");
  engine.className   = "train-engine";
  engine.textContent = "🚂";
  track.appendChild(engine);

  levelsData.forEach((lvl, idx) => {
    if (idx > 0) {
      const rail       = document.createElement("div");
      rail.className   = "rail";
      track.appendChild(rail);
    }

    const node       = document.createElement("div");
    node.className   = "level-node";

    if (lvl.completed)      node.classList.add("completed");
    else if (lvl.unlocked)  node.classList.add("unlocked");

    if (lvl.level === justUnlockedLevel) {
      node.classList.add("just-unlocked");
    }

    const icon       = document.createElement("div");
    icon.className   = "lvl-icon";
    // ✅ = completed, ⭐ = unlocked (current), 🔒 = locked
    icon.textContent = lvl.completed ? "✅" : (lvl.unlocked ? "⭐" : "🔒");

    const label       = document.createElement("div");
    label.className   = "lvl-label";
    label.textContent = "Lv " + lvl.level;

    node.appendChild(icon);
    node.appendChild(label);

    // Only attach click handler if level is accessible
    if (lvl.unlocked || lvl.completed) {
      node.addEventListener("click", () => startLevel(lvl.level));
    }

    track.appendChild(node);
  });

  // Animate newly unlocked level after a short delay
  if (justUnlockedLevel) {
    setTimeout(() => {
      const nodes = track.querySelectorAll(".level-node");
      nodes.forEach(n => {
        if (n.querySelector(".lvl-label") &&
            n.querySelector(".lvl-label").textContent === "Lv " + justUnlockedLevel) {
          n.classList.add("just-unlocked");
        }
      });
    }, 100);
  }
}

/* ── Game state ──────────────────────────────────────────────── */
let board          = [];
let flippedIndices = [];
let lockBoard      = false;
let moves          = 0;
let attempts       = 0;
let matches        = 0;
let streak         = 0;
let maxStreak      = 0;
let score          = 0;
let timerSeconds   = 0;
let timerInterval  = null;

/* ── Deck builder ────────────────────────────────────────────── */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(totalPairs) {
  const values = [];
  for (let i = 0; i < totalPairs; i++) {
    values.push(FRUITS[i % FRUITS.length]);
  }
  const deck = [...values, ...values].map(fruit => ({ fruit, matched: false }));
  return shuffle(deck);
}

/* ── Start a level ───────────────────────────────────────────── */
function startLevel(level) {
  currentLevel = level;
  const { rows, cols } = boardSizeForLevel(level);
  const totalPairs     = (rows * cols) / 2;
  board = buildDeck(totalPairs);

  // Reset all game state
  moves = 0; attempts = 0; matches = 0;
  streak = 0; maxStreak = 0; score = 0;
  timerSeconds = 0; flippedIndices = []; lockBoard = false;

  // Reset HUD
  document.getElementById("game-level-title").textContent = `Level ${level}  (${rows}×${cols})`;
  document.getElementById("hud-score").textContent    = "0";
  document.getElementById("hud-moves").textContent    = "0";
  document.getElementById("hud-matches").textContent  = "0";
  document.getElementById("hud-streak").textContent   = "0";
  document.getElementById("hud-time").textContent     = "00:00";
  document.getElementById("game-toast").textContent   = "";

  // Build card grid
  const boardEl = document.getElementById("card-board");
  boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0,1fr))`;
  boardEl.innerHTML = "";

  board.forEach((cell, i) => {
    const card       = document.createElement("div");
    card.className   = "card";
    card.dataset.index = i;
    card.innerHTML   = `
      <div class="card-inner">
        <div class="card-face card-front"></div>
        <div class="card-face card-back">${cell.fruit}</div>
      </div>`;
    card.addEventListener("click", () => onCardClick(i, card));
    boardEl.appendChild(card);
  });

  // Start timer
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const s = String(timerSeconds % 60).padStart(2, "0");
    document.getElementById("hud-time").textContent = `${m}:${s}`;
  }, 1000);

  showScreen("screen-game");
}

/* ── Card click ──────────────────────────────────────────────── */
function onCardClick(index, cardEl) {
  if (lockBoard) return;
  if (board[index].matched) return;
  if (flippedIndices.includes(index)) return;  // same card, ignore

  cardEl.classList.add("flipped");
  flippedIndices.push(index);

  if (flippedIndices.length === 2) {
    moves++;
    attempts++;
    document.getElementById("hud-moves").textContent = moves;
    lockBoard = true;
    checkForMatch();
  }
}

/* ── Match checking ──────────────────────────────────────────── */
function checkForMatch() {
  const [i1, i2] = flippedIndices;
  const card1    = document.querySelector(`.card[data-index="${i1}"]`);
  const card2    = document.querySelector(`.card[data-index="${i2}"]`);
  const isMatch  = board[i1].fruit === board[i2].fruit;

  if (isMatch) {
    setTimeout(() => {
      board[i1].matched = true;
      board[i2].matched = true;
      card1.classList.add("matched");
      card2.classList.add("matched");

      matches++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      score    += 100 + streak * 10;

      document.getElementById("hud-score").textContent   = score;
      document.getElementById("hud-streak").textContent  = streak;
      document.getElementById("hud-matches").textContent = matches;

      toast("🎉 PAIR MATCH!");
      speak("Pair match! Great job!");
      spawnSparkle(card2);

      flippedIndices = [];
      lockBoard      = false;

      if (matches === board.length / 2) {
        finishLevel();
      }
    }, 500);

  } else {
    // Wrong pair
    streak = 0;
    document.getElementById("hud-streak").textContent = "0";

    setTimeout(() => {
      // Shake the card-inner elements to avoid conflict with preserve-3d on .card
      const inner1 = card1.querySelector(".card-inner");
      const inner2 = card2.querySelector(".card-inner");
      if (inner1) inner1.classList.add("shake");
      if (inner2) inner2.classList.add("shake");
      toast("💭 TRY AGAIN");
      speak("Try again!");
    }, 350);

    setTimeout(() => {
      card1.classList.remove("flipped");
      card2.classList.remove("flipped");
      const inner1 = card1.querySelector(".card-inner");
      const inner2 = card2.querySelector(".card-inner");
      if (inner1) inner1.classList.remove("shake");
      if (inner2) inner2.classList.remove("shake");
      flippedIndices = [];
      lockBoard      = false;
    }, 1100);
  }
}

/* ── Toast notification ──────────────────────────────────────── */
function toast(text) {
  const el       = document.getElementById("game-toast");
  el.textContent = text;
  setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 1200);
}

/* ── Sparkle effect ──────────────────────────────────────────── */
function spawnSparkle(nearEl) {
  const rect         = nearEl.getBoundingClientRect();
  const sparkle      = document.createElement("div");
  sparkle.className  = "sparkle";
  sparkle.textContent = "✨";
  sparkle.style.position = "fixed";
  sparkle.style.left  = (rect.left + rect.width  / 2) + "px";
  sparkle.style.top   = (rect.top  + rect.height / 2) + "px";
  sparkle.style.zIndex = "999";
  document.body.appendChild(sparkle);
  setTimeout(() => sparkle.remove(), 750);
}

/* ── Finish level & save result ──────────────────────────────── */
async function finishLevel() {
  clearInterval(timerInterval);

  const totalPairs  = board.length / 2;
  const parMoves    = totalPairs * 2;
  const parTime     = totalPairs * 5;

  // Recalculate a final bonus score
  let finalScore = totalPairs * 100 + maxStreak * 20 + 200;
  if (moves > parMoves)         finalScore -= (moves - parMoves)         * 5;
  if (timerSeconds > parTime)   finalScore -= (timerSeconds - parTime)   * 2;
  finalScore = Math.max(finalScore, 50);
  score = Math.round(finalScore);

  try {
    const res  = await fetch("/api/save_result", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        level:          currentLevel,
        moves:          moves,
        time_seconds:   timerSeconds,
        correct_pairs:  matches,
        total_attempts: attempts,
        score:          score,
      }),
    });
    const data = await res.json();

    if (!data.ok) {
      console.error("Save result failed:", data.message);
      // Still show win screen even if save failed
    }

    document.getElementById("win-score").textContent        = score;
    document.getElementById("win-moves").textContent        = moves;
    document.getElementById("win-time").textContent         = timerSeconds + "s";
    document.getElementById("win-accuracy").textContent     = (data.accuracy   || "?") + "%";
    document.getElementById("ai-accuracy").textContent      = (data.accuracy   || "?") + "%";
    document.getElementById("ai-recommendation").textContent = data.recommendation || "Well done!";

    const unlockMsg = document.getElementById("unlock-msg");
    unlockMsg.classList.toggle("hidden", !data.unlocked_next);

    document.getElementById("btn-to-levels").dataset.unlocked =
      data.unlocked_next ? data.next_level : "";

  } catch (err) {
    console.error("Network error saving result:", err);
    document.getElementById("win-score").textContent    = score;
    document.getElementById("win-moves").textContent    = moves;
    document.getElementById("win-time").textContent     = timerSeconds + "s";
    document.getElementById("win-accuracy").textContent = "?";
    document.getElementById("ai-recommendation").textContent = "Great job!";
  }

  showScreen("screen-win");
  speak("You win! Amazing!");
  launchConfetti();
}

/* ── Confetti ────────────────────────────────────────────────── */
function launchConfetti() {
  const layer  = document.getElementById("confetti-layer");
  const colors = ["#FF6B5C", "#2BB6A6", "#FFA53E", "#FFD9A0", "#4A3B32", "#FFB347"];
  for (let i = 0; i < 70; i++) {
    setTimeout(() => {
      const piece             = document.createElement("div");
      piece.className         = "confetti-piece";
      piece.style.left        = Math.random() * 100 + "vw";
      piece.style.background  = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (2 + Math.random() * 2.5) + "s";
      piece.style.transform   = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4500);
    }, i * 40);
  }
}

/* ── DOMContentLoaded — wire everything up ───────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  startFruitBackground();
  setTimeout(() => speak("Welcome! Let's play puzzle!"), 600);

  document.getElementById("btn-play").addEventListener("click", () => {
    openAuth();
  });

  document.getElementById("auth-close").addEventListener("click", closeAuth);

  document.getElementById("go-signin").addEventListener("click", e => {
    e.preventDefault();
    showAuthPanel("signin");
  });
  document.getElementById("go-signup").addEventListener("click", e => {
    e.preventDefault();
    showAuthPanel("signup");
  });

  document.getElementById("btn-signup").addEventListener("click", doSignup);
  document.getElementById("btn-signin").addEventListener("click", doSignin);
  document.getElementById("btn-logout").addEventListener("click", doLogout);

  document.getElementById("btn-back-levels").addEventListener("click", () => goToLevelScreen());

  document.getElementById("btn-to-levels").addEventListener("click", async e => {
    const justUnlocked = e.currentTarget.dataset.unlocked;
    await loadProgress();
    renderTrainTrack(justUnlocked ? Number(justUnlocked) : null);
    showScreen("screen-levels");
    speak("Select your level!");
  });

  // Allow Enter key in auth inputs
  ["su-password", "si-password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          id.startsWith("su") ? doSignup() : doSignin();
        }
      });
    }
  });
});