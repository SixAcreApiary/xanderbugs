// Drop shadow cast by the whole bug silhouette (legs and antennae included). Bugs are drawn to an
// unshadowed layer first and composited once, so overlapping parts don't stack into darker blotches.
// Offsets point down-right, away from the top-left light the shading uses. Values are CSS pixels.
export const DROP_SHADOW = { color: 'rgba(0,0,0,0.42)', blur: 5, x: 4, y: 6 };

export function compositeWithShadow(ctx, layer, dpr = 1, shadow = DROP_SHADOW) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur * dpr;
  ctx.shadowOffsetX = shadow.x * dpr;
  ctx.shadowOffsetY = shadow.y * dpr;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}
