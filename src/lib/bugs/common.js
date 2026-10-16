// Drawing helpers. Species draw in a local frame: +x = forward, +y = bug's right side,
// body spanning roughly x ∈ [-50, 50] (100 units = bug.size pixels).

export const TAU = Math.PI * 2;

// Lighting strength. Bugs scuttling across a page look more natural lit softly from above
// than glossy under a spotlight: highlights are pulled toward the body colour and glints muted.
export const LIGHTING = { highlight: 0.3, specular: 0.3 };

// Blend two '#rrggbb' colours; t = 0 gives a, t = 1 gives b.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function withBugFrame(ctx, bug, fn) {
  ctx.save();
  ctx.translate(bug.x, bug.y);
  ctx.rotate(bug.heading);
  const k = bug.size / 100;
  ctx.scale(k, k);
  fn();
  ctx.restore();
}

// Light comes from the top-left of the screen; express it in the bug's rotated frame
// so highlights stay consistent as the bug turns.
export function localLight(heading) {
  const lx = -0.45, ly = -0.65;
  const c = Math.cos(-heading), s = Math.sin(-heading);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

// Radial body gradient whose hot spot is shifted toward the light; usable as any fillStyle.
export function bodyGradient(ctx, light, x, y, rx, ry, [hi, mid, lo]) {
  const g = ctx.createRadialGradient(
    x + light.x * rx * 0.5, y + light.y * ry * 0.5, Math.min(rx, ry) * 0.05,
    x, y, Math.max(rx, ry) * 1.05
  );
  g.addColorStop(0, mix(hi, mid, 1 - LIGHTING.highlight));
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  return g;
}

// Shaded ellipse lit from the light direction.
export function shadedEllipse(ctx, light, x, y, rx, ry, colors, rot = 0) {
  ctx.fillStyle = bodyGradient(ctx, light, x, y, rx, ry, colors);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

export function specular(ctx, light, x, y, rx, ry, alpha = 0.45) {
  const sx = x + light.x * rx * 0.45, sy = y + light.y * ry * 0.45;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(rx, ry) * 0.45);
  g.addColorStop(0, `rgba(255,255,255,${alpha * LIGHTING.specular})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

// Soft contact shadow under the body, offset away from the light.
export function groundShadow(ctx, light, x, y, rx, ry, alpha = 0.32) {
  const ox = -light.x * 6, oy = -light.y * 6;
  const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.5})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, TAU);
  ctx.fill();
}

// Jointed leg. side: -1 left, +1 right. angle measured from forward axis (0 = forward, π/2 = straight out).
// segs: [[length, bendFromPrevious, width], ...]
export function leg(ctx, hx, hy, side, angle, segs, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let x = hx, y = hy, a = angle;
  for (const [len, bend, w] of segs) {
    a += bend;
    const nx = x + Math.cos(a) * len;
    const ny = y + side * Math.sin(a) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    x = nx; y = ny;
  }
  return { x, y };
}

// pts are given for the right side (+y) and mirrored for the left. curve=true draws a quadratic through pts[0] to pts[1].
// Gait phase for one side of the body (side: -1 left, +1 right).
export function legPhase(bug, side) {
  return side < 0 ? bug.phaseL : bug.phaseR;
}

// Closed outline from right-side points [x, y], mirrored for the left side.
export function mirroredPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], -pts[i][1]);
  ctx.closePath();
}

// Fixed pseudo-random sequence so mottling and speckles are stable from frame to frame.
export function fixedRandom(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function antenna(ctx, x, y, side, pts, width, color, curve = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (curve) {
    ctx.quadraticCurveTo(pts[0][0], side * pts[0][1], pts[1][0], side * pts[1][1]);
  } else {
    for (const [px, py] of pts) ctx.lineTo(px, side * py);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------------------------
// Walking legs with planted feet.
//
// Each foot has a rest spot (the leg's neutral pose). During STANCE the foot is fixed on the ground,
// so in the body frame it slides backward exactly as far as the body moves forward; during SWING it
// lifts and travels quickly forward to its next foothold. The knee is found with two-bone IK, bending
// outward, so the leg flexes the way a real leg does instead of rotating stiffly about the hip.
//
// Gait timing (fraction of a stride cycle each leg is offset by) follows published observations:
//  - insects: alternating tripod (L1+R2+L3 vs R1+L2+R3), duty factor ~0.5 at speed, higher when slow;
//    at very slow crawling a back-to-front wave on each side, sides half a cycle apart
//  - spiders: alternating tetrapod (L1+R2+L3+R4 vs R1+L2+R3+L4)
//  - scolopendrid centipedes: retrograde metachronal wave (steps ripple head -> tail), sides alternating
// ---------------------------------------------------------------------------------------------

const frac = v => v - Math.floor(v);
const smooth = t => t * t * (3 - 2 * t);

// Forward kinematics of a leg definition in its neutral pose; returns the foot position.
export function restFoot(hx, hy, side, angle, segs) {
  let x = hx, y = hy, a = angle;
  for (const [len, bend] of segs) {
    a += bend;
    x += Math.cos(a) * len;
    y += side * Math.sin(a) * len;
  }
  return { x, y };
}

// Duty factor: share of the cycle each foot is on the ground. ~0.5 at natural pace, more when slow.
export function dutyFactor(bug, base = 0.5) {
  return Math.min(0.72, Math.max(0.42, base + (1 - (bug.speedScale ?? 1)) * 0.2));
}

// Insect leg timing. leg: 0 front, 1 middle, 2 hind. side: -1 left, +1 right.
export function insectGait(bug, leg, side) {
  const right = side > 0 ? 0.5 : 0;
  if ((bug.speedScale ?? 1) < 0.6) {
    // Slow wave gait: hind leg steps first, then middle, then front; the other side half a cycle later.
    return { offset: frac([0, 1 / 3, 2 / 3][leg] + right), duty: dutyFactor(bug) };
  }
  return { offset: frac((leg === 1 ? 0.5 : 0) + right), duty: dutyFactor(bug) };   // alternating tripod
}

// Spider leg timing (leg 0..3 front to back): alternating tetrapod.
export function tetrapodGait(bug, leg, side) {
  return { offset: frac((leg % 2 ? 0.5 : 0) + (side > 0 ? 0.5 : 0)), duty: dutyFactor(bug) };
}

// Where a walking foot is right now. Returns the foot point and how lifted it is (0 planted .. 1 apex).
export function footPosition(bug, side, rest, offset, duty, maxTravel) {
  const travel = Math.min(maxTravel, duty * (bug.stridePx ?? 0) * (100 / bug.size));
  const phi = frac(legPhase(bug, side) / TAU + offset);
  let u, lift = 0;
  if (phi < duty) {
    u = 0.5 - phi / duty;                       // planted: slides back under the advancing body
  } else {
    const s = (phi - duty) / (1 - duty);
    u = -0.5 + smooth(s);                       // swing: lifted and carried forward
    lift = Math.sin(Math.PI * s);
  }
  return { x: rest.x + u * travel, y: rest.y * (1 - 0.06 * lift), lift };
}

// Two-bone IK: knee position for a hip, a foot target and bone lengths a (femur) and b (rest of leg).
// Picks the solution with the knee bent outward, away from the body's midline.
export function solveKnee(hx, hy, fx, fy, a, b, side) {
  let dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy) || 1e-6;
  const dc = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, d));
  if (dc !== d) { dx *= dc / d; dy *= dc / d; d = dc; }
  const base = Math.atan2(dy, dx);
  const spread = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k1 = { x: hx + Math.cos(base + spread) * a, y: hy + Math.sin(base + spread) * a };
  const k2 = { x: hx + Math.cos(base - spread) * a, y: hy + Math.sin(base - spread) * a };
  const knee = side * k1.y >= side * k2.y ? k1 : k2;
  return { knee, foot: { x: hx + dx, y: hy + dy } };
}

// Draws a jointed leg from hip to foot. segs: [[femur, bend, width], [tibia, bend, width], [tarsus?, bend, width]].
export function drawJointedLeg(ctx, hx, hy, foot, side, segs, color) {
  const a = segs[0][0];
  const lower = segs.slice(1);
  const b = lower.reduce((s, [len]) => s + len, 0);
  const { knee, foot: f } = solveKnee(hx, hy, foot.x, foot.y, a, b, side);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const seg = (x0, y0, x1, y1, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  seg(hx, hy, knee.x, knee.y, segs[0][2]);
  if (lower.length === 1) {
    seg(knee.x, knee.y, f.x, f.y, lower[0][2]);
    return;
  }
  // Split the lower leg into tibia + tarsus, with the ankle nudged outward so the tarsus angles naturally.
  const t = lower[0][0] / b;
  const ux = f.x - knee.x, uy = f.y - knee.y, len = Math.hypot(ux, uy) || 1;
  const ankle = { x: knee.x + ux * t - (uy / len) * side * b * 0.06, y: knee.y + uy * t + (ux / len) * side * b * 0.06 };
  seg(knee.x, knee.y, ankle.x, ankle.y, lower[0][2]);
  seg(ankle.x, ankle.y, f.x, f.y, lower[1][2]);
}

// Half the body's width at x, for a body made of ellipses [cx, rx, ry] (0 where none covers x).
export function bodyEdge(x, ellipses) {
  let best = 0;
  for (const [cx, rx, ry] of ellipses) {
    const u = (x - cx) / rx;
    if (Math.abs(u) < 1) best = Math.max(best, ry * Math.sqrt(1 - u * u));
  }
  return best;
}

// Same, for a mirrored outline given as [x, y] points running front to back.
export function outlineEdge(x, pts) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x0 && x >= x1) return y0 + (y1 - y0) * ((x0 - x) / (x0 - x1 || 1));
  }
  return 0;
}

// Hips sit hidden under the body. A femur pivoting there sweeps its visible base back and forth along
// the body's edge as the leg swings, so the leg looks like it slides around the body. Instead the leg
// pivots just inside the outline (edge = distance from the hip out to it) and the hidden part of the
// femur is left out, so the visible joint stays put and only the leg's own joints move.
export function legPivot(hy, side, segs, edge = 0) {
  const a = segs[0][0];
  const cut = Math.min(Math.max(0, edge) * 0.85, a * 0.65);
  return { py: hy + side * cut, segs: [[a - cut, segs[0][1], segs[0][2]], ...segs.slice(1)] };
}

// One walking leg: neutral pose from (angle, segs), foot planted/swung by the gait, knee by IK.
// Returns the foot, plus the visible pivot and segments (py, segs) for drawing overlays on the same leg.
export function walkLeg(ctx, bug, { hx, hy, side, angle, segs, offset, duty, color, edge = 0, reach = 0.6 }) {
  const rest = restFoot(hx, hy, side, angle, segs);
  const total = segs.reduce((s, [len]) => s + len, 0);
  const foot = footPosition(bug, side, rest, offset, duty, total * reach);
  const pivot = legPivot(hy, side, segs, edge);
  drawJointedLeg(ctx, hx, pivot.py, foot, side, pivot.segs, color);
  return Object.assign(foot, pivot);
}
