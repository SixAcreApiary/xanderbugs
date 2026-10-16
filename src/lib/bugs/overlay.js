import { Swarm } from './engine.js';

const crowd = new Set();   // every swarm on this page, so bugs avoid each other across swarms
import { compositeWithShadow } from './shadow.js';

// Full-viewport, click-through canvas in a closed shadow root so the host page can neither style nor inspect it.
// Resolves when every bug has left the screen.
export function releaseSwarm({ species, count, speed = 1, weights, doc = document, win = window, rng = Math.random }) {
  const host = doc.createElement('div');
  host.setAttribute('data-xanderbugs-overlay', '');
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;';
  const root = host.attachShadow({ mode: 'closed' });
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  root.appendChild(canvas);
  (doc.body ?? doc.documentElement).appendChild(host);

  const ctx = canvas.getContext('2d');
  const layer = doc.createElement('canvas');
  const lctx = layer.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  const fit = () => {
    dpr = Math.min(2, win.devicePixelRatio || 1);
    w = win.innerWidth;
    h = win.innerHeight;
    canvas.width = layer.width = Math.round(w * dpr);
    canvas.height = layer.height = Math.round(h * dpr);
  };
  fit();
  const swarm = new Swarm({ species, count, speed, weights, width: w, height: h, rng, crowd });
  const onResize = () => { fit(); swarm.resize(w, h); };
  win.addEventListener('resize', onResize);

  return new Promise(resolve => {
    let last = win.performance.now();
    const frame = now => {
      const dt = (now - last) / 1000;
      last = now;
      swarm.update(dt);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, w, h);
      swarm.draw(lctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      compositeWithShadow(ctx, layer, dpr);
      if (swarm.done) {
        win.removeEventListener('resize', onResize);
        host.remove();
        resolve(swarm.bugs.length);
      } else {
        win.requestAnimationFrame(frame);
      }
    };
    win.requestAnimationFrame(frame);
  });
}
