import { useEffect, useRef } from 'react';

/** Decoration only: every layer lets clicks, selection and video controls through. */
export function SurfaceLight() {
  return <span className="surface-light" aria-hidden="true">
    <span className="surface-light-spot" />
    <span className="surface-light-edge" />
    <span className="surface-light-sheen" />
  </span>;
}

/** Soft moving light, scoped to existing showcase content. No extra media request. */
export function LightAtmosphere() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const sync = () => {
      element.dataset.flow = visible && !document.hidden && !reduced.matches ? 'running' : 'paused';
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { rootMargin: '80px' });
    observer.observe(element);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return <div ref={ref} className="light-atmosphere" data-flow="paused" aria-hidden="true">
    <span className="light-atmosphere-lime" />
    <span className="light-atmosphere-mint" />
    <span className="light-atmosphere-halo" />
  </div>;
}

/** One delegated listener also handles cards replaced by the project selector. */
export function installSurfaceLights() {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active: HTMLElement | null = null;
  let bounds: DOMRect | null = null;
  let frame = 0;
  let x = 0;
  let y = 0;
  let overControl = false;
  let listening = false;
  const properties = ['--light-x', '--light-y', '--light-axis-x', '--light-axis-y', '--light-angle'];

  const surfaceAt = (target: EventTarget | null) => target instanceof Element
    ? target.closest<HTMLElement>('[data-light-surface]') : null;

  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      active.classList.remove('is-lit');
      properties.forEach(property => active?.style.removeProperty(property));
    }
    active = null;
    bounds = null;
  };

  const paint = () => {
    frame = 0;
    if (!active?.isConnected || !bounds?.width || !bounds.height) { reset(); return; }
    const px = Math.min(1, Math.max(0, (x - bounds.left) / bounds.width));
    const py = Math.min(1, Math.max(0, (y - bounds.top) / bounds.height));
    active.style.setProperty('--light-x', `${(px * 100).toFixed(2)}%`);
    active.style.setProperty('--light-y', `${(py * 100).toFixed(2)}%`);
    // Independent rotate leaves existing reveal/carousel transforms intact.
    const tilt = overControl ? 0 : Math.min(3, Math.max(0, Number(active.dataset.lightTilt) || 0));
    const rx = (0.5 - py) * tilt;
    const ry = (px - 0.5) * tilt;
    const angle = Math.hypot(rx, ry);
    active.style.setProperty('--light-axis-x', angle ? String(rx / angle) : '0');
    active.style.setProperty('--light-axis-y', angle ? String(ry / angle) : '1');
    active.style.setProperty('--light-angle', `${angle.toFixed(3)}deg`);
  };

  const move = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.buttons || document.hidden) { reset(); return; }
    const surface = surfaceAt(event.target);
    if (!surface) { reset(); return; }
    if (surface !== active) {
      reset();
      active = surface;
      bounds = surface.getBoundingClientRect();
      surface.classList.add('is-lit');
    }
    x = event.clientX;
    y = event.clientY;
    overControl = event.target instanceof Element && Boolean(event.target.closest('video, button, a, input, textarea, select'));
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const leave = (event: PointerEvent) => {
    if (active && (!(event.relatedTarget instanceof Node) || !active.contains(event.relatedTarget))) reset();
  };
  const visibility = () => { if (document.hidden) reset(); };
  const listen = (enabled: boolean) => {
    if (listening === enabled) return;
    listening = enabled;
    if (enabled) {
      document.addEventListener('pointermove', move, { passive: true });
      document.addEventListener('pointerout', leave, { passive: true });
      document.addEventListener('pointercancel', reset, { passive: true });
      document.addEventListener('pointerdown', reset, { passive: true });
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('scroll', reset, { passive: true, capture: true });
      window.addEventListener('resize', reset);
      window.addEventListener('blur', reset);
    } else {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('pointercancel', reset);
      document.removeEventListener('pointerdown', reset);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('scroll', reset, true);
      window.removeEventListener('resize', reset);
      window.removeEventListener('blur', reset);
      reset();
    }
  };
  const sync = () => listen(finePointer.matches && !reduced.matches);
  finePointer.addEventListener('change', sync);
  reduced.addEventListener('change', sync);
  sync();
  return () => {
    listen(false);
    finePointer.removeEventListener('change', sync);
    reduced.removeEventListener('change', sync);
  };
}
