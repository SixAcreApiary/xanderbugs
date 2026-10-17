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
  bug.legPoses = [];   // walking legs drawn this frame add their pose (for tests and diagnostics)
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

// Duty factor: share of the cycle each foot is on the ground. ~0.5 at natural pace, more when slow, less
// while running (bug.run: how far a burst of speed has lengthened the stride).
export function dutyFactor(bug, base = 0.5) {
  return Math.min(0.72, Math.max(0.42, base + (1 - (bug.speedScale ?? 1)) * 0.2 - ((bug.run ?? 1) - 1) * 0.25));
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

// Spider leg timing (leg 0..3 front to back): alternating tetrapod, but the legs of a tetrapod don't lift in
// lockstep. Each side steps in a back-to-front ripple (IV, then III... a little ahead of the leg in front), so
// adjacent legs sit near, not exactly, half a cycle apart; the two sides stay half a cycle apart. Walking
// spiders keep most feet down (duty factor ~0.6-0.7).
export const SPIDER_RIPPLE = 0.07;
export function tetrapodGait(bug, leg, side) {
  return { offset: frac((leg % 2 ? 0.5 : 0) + (side > 0 ? 0.5 : 0) + leg * SPIDER_RIPPLE), duty: dutyFactor(bug, 0.64) };
}

// Turning is modelled as the feet walking round the body centre; this is the lever (as a fraction of
// body length) that sets how much one side's gait phase advances per radian turned.
export const TURN_RADIUS = 0.35;
const TURN_UNITS = TURN_RADIUS * 100;   // the same lever in body-drawing units

// Gait drive for one side (side: -1 left, +1 right) from forward travel and rotation (turn * lever,
// +turn = clockwise on screen, so the left side is outer). The rotation term also covers the sideways
// stepping that front and hind feet need when the body swivels. It is never negative: feet that must
// move backward (the inner side of a tight turn) get that from their stride direction, so the drive
// doesn't flip sign as a side passes from stepping forward to stepping back, which snapped legs.
export function sideDrive(fwd, rot, side) {
  return Math.hypot(fwd - side * rot, rot);
}

// Direction a foot strides in, in the body frame, per unit of its side's gait drive. Walking straight it is
// straight ahead; when turning, each foot steps along its own arc round the body centre, so a planted foot
// stays put on the ground instead of being dragged round as if the bug stood on a turntable.
export function strideDirection(bug, side, rest) {
  const t = bug.turnMix ?? 0, fwd = 1 - Math.abs(t);
  const s = sideDrive(fwd, t, side);
  return { x: (fwd - t * rest.y / TURN_UNITS) / s, y: (t * rest.x / TURN_UNITS) / s };
}

// Where a walking foot is right now. Returns the foot point and how lifted it is (0 planted .. 1 apex).
// With a hip given ({ x, y, fold, bulge }), a swinging foot is carried round it (the leg pivots at the hip)
// rather than straight across. Through the swing the leg first folds, drawing the foot in by `fold` of its reach
// as it lifts clear, then reaches out by `bulge` beyond it before setting down; the leg's own lift is left to the
// caller (see walkLeg3D).
export function footPosition(bug, side, rest, offset, duty, maxTravel, hip = null) {
  const dir = strideDirection(bug, side, rest);
  const travel = Math.min(maxTravel / Math.max(1, Math.hypot(dir.x, dir.y)), duty * (bug.stridePx ?? 0) * (100 / bug.size));
  const phi = frac(legPhase(bug, side) / TAU + offset);
  let u, lift = 0, s;
  if (phi < duty) {
    u = 0.5 - phi / duty;                       // planted: slides back under the advancing body
  } else {
    s = (phi - duty) / (1 - duty);
    u = -0.5 + smooth(s);                       // swing: lifted and carried forward
    lift = Math.sin(Math.PI * s);
    if (hip) {
      const a = groundPoint(bug, side, rest, -0.5 * travel), b = groundPoint(bug, side, rest, 0.5 * travel);
      const t = u + 0.5, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const ra = Math.hypot(a.x - hip.x, a.y - hip.y), rb = Math.hypot(b.x - hip.x, b.y - hip.y);
      const wave = Math.sin(2 * Math.PI * s);
      const r = (ra + (rb - ra) * t) * (1 - (hip.fold ?? 0) * Math.max(0, wave) + (hip.bulge ?? 0) * Math.max(0, -wave));
      const d = Math.hypot(p.x - hip.x, p.y - hip.y) || 1;
      return { x: hip.x + (p.x - hip.x) * r / d, y: hip.y + (p.y - hip.y) * r / d, lift, swing: s };
    }
  }
  const p = groundPoint(bug, side, rest, u * travel);
  return { x: p.x, y: p.y * (1 - 0.06 * lift), lift, swing: s };
}

// Where a point on the ground that lies under `rest` now will appear, in the body frame, once the body has
// moved back by `ahead` units of its side's stride. Along a turn that is an arc round the turning centre.
function groundPoint(bug, side, rest, ahead) {
  const t = bug.turnMix ?? 0, fwd = 1 - Math.abs(t);
  const lam = -ahead / sideDrive(fwd, t, side);     // body travel (units) since the foot was at rest
  const a = (t * lam) / TURN_UNITS;                  // body rotation over that travel
  const sinc = Math.abs(a) < 1e-6 ? 1 : Math.sin(a) / a;
  const cosc = Math.abs(a) < 1e-6 ? a / 2 : (1 - Math.cos(a)) / a;
  const dx = rest.x - fwd * lam * sinc, dy = rest.y - fwd * lam * cosc;
  const c = Math.cos(a), sn = Math.sin(a);
  return { x: dx * c + dy * sn, y: -dx * sn + dy * c };
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
// Joint positions of a jointed leg reaching for a foot: hip, knee, ankle (where the tarsus starts; the foot
// itself for two-part legs) and foot. Anything attached to a leg segment can be placed from these.
// When the foot comes in closer to the hip than the knee alone can fold (the tibia and tarsus together are much
// longer than the femur), the ankle folds too, keeping both its segments' lengths, so the foot still reaches.
export function legJoints(hx, hy, foot, side, segs) {
  const a = segs[0][0];
  const lower = segs.slice(1);
  const b = lower.reduce((s, [len]) => s + len, 0);
  const d = Math.hypot(foot.x - hx, foot.y - hy);
  const folded = lower.length > 1 && b - a > d ? Math.max(Math.abs(lower[0][0] - lower[1][0]) + 1e-3, d + a * 0.98) : b;
  const { knee, foot: f } = solveKnee(hx, hy, foot.x, foot.y, a, Math.min(b, folded), side);
  if (lower.length === 1) return { hip: { x: hx, y: hy }, knee, ankle: f, foot: f };
  if (folded < b) return { hip: { x: hx, y: hy }, knee, ankle: solveKnee(knee.x, knee.y, f.x, f.y, lower[0][0], lower[1][0], side).knee, foot: f };
  // Split the lower leg into tibia + tarsus, with the ankle nudged outward so the tarsus angles naturally.
  const t = lower[0][0] / b;
  const ux = f.x - knee.x, uy = f.y - knee.y, len = Math.hypot(ux, uy) || 1;
  const ankle = { x: knee.x + ux * t - (uy / len) * side * b * 0.06, y: knee.y + uy * t + (ux / len) * side * b * 0.06 };
  return { hip: { x: hx, y: hy }, knee, ankle, foot: f };
}

export function drawJointedLeg(ctx, hx, hy, foot, side, segs, color) {
  const { knee, ankle, foot: f } = legJoints(hx, hy, foot, side, segs);
  const lower = segs.slice(1);
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
// femur is left out, so the visible joint stays put and only the leg's own joints move. Where the body
// covers more than most of the femur, the pivot still goes to the edge and a short stub of femur is kept
// (stub: the leg then stands from the pivot, as if the hip were there).
export function legPivot(hy, side, segs, edge = 0) {
  const a = segs[0][0];
  const cut = Math.max(0, edge);
  const stub = a - cut < a * 0.35;
  return { py: hy + side * cut, segs: [[stub ? a * 0.35 : a - cut, segs[0][1], segs[0][2]], ...segs.slice(1)], stub };
}

// One walking leg: neutral pose from (angle, segs), foot planted/swung by the gait, knee by IK.
// Returns the foot, plus the visible pivot and segments (py, segs) for drawing overlays on the same leg, and
// the joints it was drawn with (joints) so things carried on a segment can move with it.
// Planted feet stick to the page (stickyFoot), each leg known by its order among the legs drawn this frame;
// pass sticky: false for a leg not drawn in the bug's own frame (a centipede's legs ride on its segments). As a
// spider's, a swinging foot is carried round the hip, folding in a little then reaching out (fold, bulge), and a
// touched leg flinches (bug.recoil, see touchLegs).
export function walkLeg(ctx, bug, { hx, hy, side, angle, segs, offset, duty, color, edge = 0, reach = 0.75, sticky = true, fold = 0.06, bulge = 0.03 }) {
  const pivot = legPivot(hy, side, segs, edge);
  const rest = pivot.stub ? restFoot(hx, pivot.py, side, angle, pivot.segs) : restFoot(hx, hy, side, angle, segs);
  const total = (pivot.stub ? pivot.segs : segs).reduce((s, [len]) => s + len, 0);
  const index = bug.legPoses?.length, key = sticky && bug.legPoses ? `w${index}` : null;
  const hip = { x: hx, y: pivot.py, fold, bulge };
  const planted = stickyFoot(bug, key, footPosition(bug, side, rest, offset, duty, total * reach, hip), total * reach * 0.8);
  const pull = 1 - RECOIL_PULL * (bug.recoil?.[index] ?? 0);
  const foot = { ...planted, x: hx + (planted.x - hx) * pull, y: pivot.py + (planted.y - pivot.py) * pull };
  // The neutral pose has the leg nearly straight, so at the far end of a stride the planted foot would be out of
  // reach and the drawn foot would skate. The lower leg is made just long enough to reach it there (the feet stay
  // where the pose puts them; the knee simply bends a little more), using the walking stride, not a running burst's.
  // The femur keeps its length: a longer one would swing in under the body's edge; and a leg that only shows a stub
  // of femur from under a shell keeps its pose, as any extra length would fold its knee in under the shell.
  const travel = Math.min(total * reach, duty * ((bug.stridePx ?? 0) / (bug.run ?? 1)) * (100 / bug.size));
  const need = (Math.hypot(rest.x - hx, rest.y - pivot.py) + travel / 2) / 0.97;
  const femur = pivot.segs[0][0], lower = pivot.segs.slice(1).reduce((s, [len]) => s + len, 0);
  const k = pivot.stub ? 1 : Math.max(1, (need - femur) / lower);
  const drawn = k > 1 ? pivot.segs.map(([len, b, w], i) => [i ? len * k : len, b, w]) : pivot.segs;
  drawJointedLeg(ctx, hx, pivot.py, foot, side, drawn, color);
  const joints = legJoints(hx, pivot.py, foot, side, drawn);
  bug.legPoses?.push({ ...joints, lift: foot.lift });
  return Object.assign(foot, pivot, { segs: drawn, joints });
}

// ---------------------------------------------------------------------------------------------
// Legs in three dimensions (spiders). Each leg lies in an upright plane through its hip: the femur climbs to
// a high knee, the tibia drops from it and the metatarsus and tarsus reach down to the foot. Posing the leg in
// that plane and looking down on it gives the arched, foreshortened look of a real spider's legs, and the
// knee moves smoothly as the foot travels instead of flipping like a flat linkage. A swinging foot lifts,
// reaches out and sets down; heights (z, body units above the ground) also place the leg's shadow.
// ---------------------------------------------------------------------------------------------

const clamp1 = v => Math.max(-1, Math.min(1, v));

// Joints of a leg with segment lengths [a, b, c], hip `hz` above the ground and the foot `fz` above it.
// curl (radians, signed like a leg's bend; side -1 left, +1 right) swings the knee and, less, the ankle round
// the hip off the hip-foot line, so legs curve forward or back as real ones do rather than lying dead straight.
export function legPose3D(hip, hz, foot, fz, [a, b, c], curl = 0, side = 1) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.hypot(dx, dy) || 1e-6, ux = dx / d, uy = dy / d;
  // The tarsus meets the ground steeply when the foot is close in and flatter when the leg is stretched out;
  // flatter still if the knee couldn't otherwise reach.
  let phi = Math.min(1.2, Math.max(0.25, 1.3 - 1.2 * d / (a + b + c)));
  let ar = d - c * Math.cos(phi), az = fz + c * Math.sin(phi);
  while (phi > 0 && Math.hypot(ar, az - hz) > (a + b) * 0.995) {
    phi = Math.max(0, phi - 0.1);
    ar = d - c * Math.cos(phi); az = fz + c * Math.sin(phi);
  }
  const e = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, Math.hypot(ar, az - hz)));
  const up = Math.atan2(az - hz, ar) + Math.acos(clamp1((a * a + e * e - b * b) / (2 * a * e)));   // knee bent upward
  const at = (r, z, turn = 0) => {
    const t = -side * curl * turn, c = Math.cos(t), s = Math.sin(t);
    return { x: hip.x + (ux * c - uy * s) * r, y: hip.y + (ux * s + uy * c) * r, z };
  };
  return { hip: at(0, hz), knee: at(Math.cos(up) * a, hz + Math.sin(up) * a, 0.9), ankle: at(ar, az, 0.35), foot: at(d, fz) };
}

// Planted feet stick to the page. footPosition places a foot from the stride phase alone, which is exact while
// walking steadily, but steering keeps changing how the stride bends (turnMix), and in a crowd that dragged
// planted feet about. So once a foot touches down its spot on the page is kept until it lifts (never further
// than `limit` from where the gait wants it), and the next swing blends from where it really was to where the
// gait wants it to land. State lives on bug.feet[key]; without a key or a placed bug it is just the gait's.
export function stickyFoot(bug, key, target, limit) {
  if (key == null || !Number.isFinite(bug.x) || !Number.isFinite(bug.heading)) return target;
  const k = bug.size / 100, c = Math.cos(bug.heading), sn = Math.sin(bug.heading);
  const toWorld = p => ({ x: bug.x + (p.x * c - p.y * sn) * k, y: bug.y + (p.x * sn + p.y * c) * k });
  const toLocal = w => {
    const dx = (w.x - bug.x) / k, dy = (w.y - bug.y) / k;
    return { x: dx * c + dy * sn, y: -dx * sn + dy * c };
  };
  const st = ((bug.feet ??= {})[key] ??= { planted: false, last: null, off: { x: 0, y: 0 }, s0: 0 });
  let p;
  if (!target.lift) {
    if (!st.planted) { st.planted = true; st.world = toWorld(st.last ?? target); }
    p = toLocal(st.world);
    const dx = p.x - target.x, dy = p.y - target.y, d = Math.hypot(dx, dy);
    if (d > limit) { p = { x: target.x + dx * limit / d, y: target.y + dy * limit / d }; st.world = toWorld(p); }
  } else {
    if (st.planted || !st.last) {
      const from = st.last ?? target;
      st.planted = false;
      st.off = { x: from.x - target.x, y: from.y - target.y };
      st.s0 = target.swing ?? 0;
    }
    // The leftover offset fades out over the rest of the swing, whichever way the stride is running.
    const s = target.swing ?? 0, s0 = st.s0;
    const w = s0 < 0.5 ? (1 - smooth(s)) / Math.max(1e-6, 1 - smooth(s0)) : smooth(s) / Math.max(1e-6, smooth(s0));
    const f = Math.max(0, Math.min(1, w));
    p = { x: target.x + st.off.x * f, y: target.y + st.off.y * f };
  }
  st.last = p;
  return { x: p.x, y: p.y, lift: target.lift, swing: target.swing };
}

// One walking leg posed in 3D. The neutral pose (angle, segs) sets where the foot rests, as for walkLeg; the
// leg itself is `arch` times longer than that reach, which is what lifts the knee and lets the foot travel
// further (reach) than a flat leg's. recoil (0..1) is a flinch from being touched: the foot is drawn back toward
// the hip and lifted a little, without moving the spot it is planted on, so it settles back as the flinch fades.
// Returns the joints.
export const RECOIL_PULL = 0.1, RECOIL_LIFT = 0.05;
export function walkLeg3D(bug, { hx, hy, side, angle, segs, offset, duty, edge = 0, reach = 1.25, hz = 6, lift = 0.12, arch = 1.45, fold = 0.14, bulge = 0.07, curl = 0, key = null, recoil = 0 }) {
  const pivot = legPivot(hy, side, segs, edge);
  const rest = pivot.stub ? restFoot(hx, pivot.py, side, angle, pivot.segs) : restFoot(hx, hy, side, angle, segs);
  const hip = { x: hx, y: pivot.py, fold, bulge };
  const span = Math.hypot(rest.x - hip.x, rest.y - hip.y);
  const lens = pivot.segs.map(([len]) => len);
  const k = (span * arch) / lens.reduce((s, l) => s + l, 0);
  const foot = stickyFoot(bug, key, footPosition(bug, side, rest, offset, duty, span * reach, hip), span * 0.8);
  const pull = 1 - RECOIL_PULL * recoil;
  const shown = { x: hip.x + (foot.x - hip.x) * pull, y: hip.y + (foot.y - hip.y) * pull };
  const up = Math.max(foot.lift * lift, recoil * RECOIL_LIFT) * span;
  return Object.assign(legPose3D(hip, hz, shown, up, lens.map(l => l * k), curl, side), { lift: Math.max(foot.lift, recoil * RECOIL_LIFT / lift) });
}

// The page is seen from a little off overhead, so a joint above the hip shows shifted toward the light (which
// is fixed on screen, so planted feet still stay put as the bug turns) and one below it away from the light.
export const VIEW_TILT = 0.4;
const viewed = (light, p, hz) => ({ x: p.x + light.x * (p.z - hz) * VIEW_TILT, y: p.y + light.y * (p.z - hz) * VIEW_TILT });

const LEG_JOINTS = ['hip', 'knee', 'ankle', 'foot'];

// A posed 3D leg as seen on the page; widths per segment (femur, tibia, tarsus).
export function drawLeg3D(ctx, light, pose, widths, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = LEG_JOINTS.map(j => viewed(light, pose[j], pose.hip.z));
  for (let i = 0; i < 3; i++) {
    const p = pts[i], q = pts[i + 1];
    ctx.lineWidth = widths[i];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
}

// The leg's soft shadow on the ground: each joint pushed away from the light in proportion to its height. A
// lifted leg's shadow fades out (it would otherwise read as a blurred double of the moving leg).
export function legShadow(ctx, light, pose, width, alpha = 0.14) {
  const a = alpha * (1 - (pose.lift ?? 0));
  if (a < 0.005) return;
  ctx.strokeStyle = `rgba(0,0,0,${a.toFixed(3)})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  LEG_JOINTS.forEach((j, i) => {
    const { x, y } = viewed(light, pose[j], pose.hip.z), z = pose[j].z;
    ctx[i ? 'lineTo' : 'moveTo'](x - light.x * z * 0.6, y - light.y * z * 0.6);
  });
  ctx.stroke();
}
