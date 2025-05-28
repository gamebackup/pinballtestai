const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// Game State
let score = 0;
let running = true;
let leftFlipperUp = false, rightFlipperUp = false;

// Ball
let ball = {
  x: W/2,
  y: H-120,
  vx: 2.5,
  vy: -8,
  radius: 12,
  color: '#f5f542'
};

// Flippers
const flipperLength = 80;
const flipperWidth = 18;
const flipperAngleUp = Math.PI/4;
const flipperAngleDown = -Math.PI/6;
const flipperY = H-60;

let leftFlipper = {
  x: W/2-60, y: flipperY,
  angle: flipperAngleDown,
  pivotX: W/2-60, pivotY: flipperY
};

let rightFlipper = {
  x: W/2+60, y: flipperY,
  angle: -flipperAngleDown,
  pivotX: W/2+60, pivotY: flipperY
};

// Bumpers
const bumpers = [
  {x: W/2,   y: 170, r: 28, color: '#f5426c', value: 100},
  {x: W/2-90, y: 250, r: 20, color: '#42f554', value: 50},
  {x: W/2+90, y: 250, r: 20, color: '#42c6f5', value: 50},
  {x: W/2-60, y: 350, r: 16, color: '#f5b942', value: 25},
  {x: W/2+60, y: 350, r: 16, color: '#f542d4', value: 25}
];

// Walls
const walls = [
  {x1: 30, y1: 30, x2: 30, y2: H-80},
  {x1: W-30, y1: 30, x2: W-30, y2: H-80},
  {x1: 30, y1: 30, x2: W-30, y2: 30},
  // Sloped bottom walls
  {x1: 30, y1: H-80, x2: W/2-100, y2: H-10},
  {x1: W-30, y1: H-80, x2: W/2+100, y2: H-10}
];

function resetBall() {
  ball.x = W/2;
  ball.y = H-120;
  ball.vx = 2.5 * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = -8;
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, 2*Math.PI);
  ctx.fillStyle = ball.color;
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawFlipper(f, left) {
  ctx.save();
  ctx.translate(f.pivotX, f.pivotY);
  ctx.rotate(f.angle);
  ctx.beginPath();
  ctx.rect(-flipperLength/2, -flipperWidth/2, flipperLength, flipperWidth);
  ctx.fillStyle = left ? "#ffb300" : "#2196f3";
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBumpers() {
  for (const b of bumpers) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, 2*Math.PI);
    ctx.fillStyle = b.color;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
}

function drawWalls() {
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#888";
  for (const w of walls) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
}

// Physics helpers
function reflectBall(normalX, normalY) {
  // Reflect ball velocity vector about the normal
  const dot = ball.vx * normalX + ball.vy * normalY;
  ball.vx -= 2 * dot * normalX;
  ball.vy -= 2 * dot * normalY;
}

function wallCollision() {
  for (const w of walls) {
    // Line segment wall collision
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    const nx = -dy/len, ny = dx/len; // Outward normal
    const px = ball.x - w.x1, py = ball.y - w.y1;
    // Project point to wall
    const proj = (px*dx + py*dy)/len;
    if (proj > 0 && proj < len) {
      // Closest point on wall
      const cx = w.x1 + proj*dx/len, cy = w.y1 + proj*dy/len;
      const dist = Math.hypot(ball.x-cx, ball.y-cy);
      if (dist < ball.radius) {
        // Push back
        const overlap = ball.radius-dist;
        ball.x += nx*overlap;
        ball.y += ny*overlap;
        reflectBall(nx, ny);
      }
    }
  }
}

function bumperCollision() {
  for (const b of bumpers) {
    const dx = ball.x-b.x, dy = ball.y-b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ball.radius+b.r) {
      // Reflect
      const nx = dx/dist, ny = dy/dist;
      reflectBall(nx, ny);
      ball.x = b.x + nx*(ball.radius+b.r+1);
      ball.y = b.y + ny*(ball.radius+b.r+1);
      score += b.value;
      document.getElementById('score').innerText = "Score: " + score;
      // Add extra speed
      ball.vx *= 1.05;
      ball.vy *= 1.05;
    }
  }
}

function flipperCollision(flipper, isLeft) {
  // Approximate flipper as rectangle for collision (broad phase)
  ctx.save();
  ctx.translate(flipper.pivotX, flipper.pivotY);
  ctx.rotate(flipper.angle);
  // Ball relative to flipper
  const rx = Math.cos(-flipper.angle)*(ball.x-flipper.pivotX) - Math.sin(-flipper.angle)*(ball.y-flipper.pivotY);
  const ry = Math.sin(-flipper.angle)*(ball.x-flipper.pivotX) + Math.cos(-flipper.angle)*(ball.y-flipper.pivotY);
  if (
    rx > -flipperLength/2-ball.radius && rx < flipperLength/2+ball.radius &&
    Math.abs(ry) < flipperWidth/2+ball.radius
  ) {
    // Compute normal: perpendicular to top/bottom of flipper
    const nx = Math.sin(flipper.angle);
    const ny = -Math.cos(flipper.angle);
    // Apply velocity
    reflectBall(nx, ny);
    // Add boost if flipper is up
    if ((isLeft && leftFlipperUp) || (!isLeft && rightFlipperUp)) {
      ball.vx += nx*8;
      ball.vy += ny*8;
    }
    // Push out
    ball.x += nx * ball.radius;
    ball.y += ny * ball.radius;
  }
  ctx.restore();
}

// Main game loop
function update() {
  if (!running) return;
  // Ball physics
  ball.vy += 0.23; // gravity
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Collisions
  wallCollision();
  bumperCollision();
  flipperCollision(leftFlipper, true);
  flipperCollision(rightFlipper, false);

  // Flipper angles
  leftFlipper.angle += ((leftFlipperUp ? flipperAngleUp : flipperAngleDown) - leftFlipper.angle) * 0.4;
  rightFlipper.angle += ((rightFlipperUp ? -flipperAngleUp : -flipperAngleDown) - rightFlipper.angle) * 0.4;

  // Ball out of bounds
  if (ball.y > H+40) {
    running = false;
    document.getElementById('score').innerText += "  |  Game Over! Press Space";
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawWalls();
  drawBumpers();
  drawFlipper(leftFlipper, true);
  drawFlipper(rightFlipper, false);
  drawBall();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// Input
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') leftFlipperUp = true;
  if (e.code === 'ArrowRight') rightFlipperUp = true;
  if (e.code === 'Space' && !running) {
    running = true;
    score = 0;
    document.getElementById('score').innerText = "Score: 0";
    resetBall();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') leftFlipperUp = false;
  if (e.code === 'ArrowRight') rightFlipperUp = false;
});

resetBall();
gameLoop();
