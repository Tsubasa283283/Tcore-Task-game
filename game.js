const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

const state = {
  running: true,
  score: 0,
  time: 0,
  spawnTimer: 0,
  keys: new Set(),
  player: {
    x: 90,
    y: canvas.height / 2,
    size: 20,
    speed: 220,
  },
  enemies: [],
};

function reset() {
  state.running = true;
  state.score = 0;
  state.time = 0;
  state.spawnTimer = 0;
  state.enemies = [];
  state.player.x = 90;
  state.player.y = canvas.height / 2;
  scoreEl.textContent = "0";
  statusEl.textContent = "Go!";
}

function spawnEnemy() {
  const size = 14 + Math.random() * 24;
  const speed = 120 + Math.random() * 170 + state.time * 4;
  state.enemies.push({
    x: canvas.width + size,
    y: size + Math.random() * (canvas.height - size * 2),
    size,
    speed,
  });
}

function movePlayer(dt) {
  const p = state.player;
  const amount = p.speed * dt;

  if (state.keys.has("ArrowUp")) p.y -= amount;
  if (state.keys.has("ArrowDown")) p.y += amount;
  if (state.keys.has("ArrowLeft")) p.x -= amount;
  if (state.keys.has("ArrowRight")) p.x += amount;

  p.x = Math.max(p.size, Math.min(canvas.width - p.size, p.x));
  p.y = Math.max(p.size, Math.min(canvas.height - p.size, p.y));
}

function updateEnemies(dt) {
  for (const e of state.enemies) {
    e.x -= e.speed * dt;
  }
  state.enemies = state.enemies.filter((e) => e.x > -e.size);
}

function hit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < a.size + b.size;
}

function checkCollision() {
  const p = state.player;
  for (const e of state.enemies) {
    if (hit(p, e)) {
      state.running = false;
      statusEl.textContent = `Game Over! Score: ${state.score}（リスタートで再挑戦）`;
      return;
    }
  }
}

function updateScore(dt) {
  state.score += Math.floor(dt * 60);
  scoreEl.textContent = String(state.score);
}

function drawCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#1a2d4a";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  drawCircle(state.player.x, state.player.y, state.player.size, "#6ee7b7");

  for (const e of state.enemies) {
    drawCircle(e.x, e.y, e.size, "#f87171");
  }
}

let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state.running) {
    state.time += dt;
    state.spawnTimer += dt;

    movePlayer(dt);

    const interval = Math.max(0.25, 0.95 - state.time * 0.03);
    if (state.spawnTimer >= interval) {
      state.spawnTimer = 0;
      spawnEnemy();
    }

    updateEnemies(dt);
    checkCollision();
    updateScore(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    state.keys.add(e.key);
  }
});

window.addEventListener("keyup", (e) => {
  state.keys.delete(e.key);
});

restartBtn.addEventListener("click", reset);

reset();
requestAnimationFrame(loop);
