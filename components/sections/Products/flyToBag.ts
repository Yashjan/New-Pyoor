/**
 * "Add to bag": a small copy of the jar flies along a gentle arc into the header's Bag
 * (0.6 s, transform and opacity only). Nothing waits for it. Off under reduced motion.
 */
export function flyToBag(from: HTMLImageElement | null) {
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bag = document.querySelector<HTMLElement>('[data-bag-target]');
  if (!bag) return;
  const a = from.getBoundingClientRect();
  const b = bag.getBoundingClientRect();
  if (!a.width || !b.width) return;
  // start as a small jar (64 px tall) at the image's centre
  const h = 64;
  const w = (h * a.width) / a.height;
  const x0 = a.left + a.width / 2 - w / 2;
  const y0 = a.top + a.height / 2 - h / 2;
  const dx = b.left + b.width / 2 - (x0 + w / 2);
  const dy = b.top + b.height / 2 - (y0 + h / 2);
  const img = document.createElement('img');
  img.src = from.currentSrc || from.src;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    position: 'fixed',
    left: `${x0}px`,
    top: `${y0}px`,
    width: `${w}px`,
    height: `${h}px`,
    objectFit: 'contain',
    zIndex: '200',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  });
  document.body.appendChild(img);
  // the arc: up first, then down into the bag
  const lift = Math.min(160, Math.abs(dy) * 0.35 + 60);
  const anim = img.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(0.8)`,
        opacity: 1,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.3 },
    ],
    { duration: 600, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
  );
  const done = () => img.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}
