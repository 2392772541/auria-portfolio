import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './cyber-home-sections.css';
import './xiaoyang-hero.css';
import './portfolio-dark.css';
import './portfolio-motion.css';
import './admin-motion.css';
import './portfolio-showcase.css';
import './surface-light.css';
import { installSurfaceLights } from './components/SurfaceLight';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const routePage = new URLSearchParams(window.location.search).get('page');
const routePath = routePage ? `/${routePage.replace(/^\/+/, '')}` : window.location.pathname;
if (routePath !== '/admin') {
  const disposeSurfaceLights = installSurfaceLights();
  import.meta.hot?.dispose(disposeSurfaceLights);
}
const pageTitles: Record<string, string> = {
  '/': 'XiaoYang — Portfolio',
  '/work': 'Selected Work — XiaoYang',
  '/open-source': 'Open Source — XiaoYang',
  '/writing': 'Field Notes — XiaoYang',
  '/about': 'About — XiaoYang',
  '/contact': 'Contact — XiaoYang',
};
document.title = routePath.startsWith('/work/')
  ? pageTitles['/work']
  : routePath.startsWith('/writing/')
    ? 'Field Note — XiaoYang'
    : pageTitles[routePath] || '404 — XiaoYang';

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  const link = target?.closest('a') as HTMLAnchorElement | null;
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
  if (link.origin !== window.location.origin || link.hash && link.pathname === window.location.pathname) return;
  event.preventDefault();
  document.documentElement.classList.add('page-leaving');
  window.setTimeout(() => { window.location.assign(link.href); }, 180);
});

window.setTimeout(() => {
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.xiaoyang-navlinks a'));
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.home-cyber > section[id], .home-cyber > footer'));
  if (!navLinks.length || !sections.length) return;
  const activate = (id: string) => navLinks.forEach(link => { const active = link.getAttribute('href') === `#${id}`; link.classList.toggle('is-active', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) activate(entry.target.id || 'contact'); }), { threshold: .45 });
  sections.forEach(section => observer.observe(section));
  const syncByScroll = () => { let current = sections[0].id || 'contact'; sections.forEach(section => { if (section.getBoundingClientRect().top <= window.innerHeight * .45) current = section.id || 'contact'; }); activate(current); };
  addEventListener('scroll', syncByScroll, { passive: true });
  syncByScroll();
}, 500);

// Keep externally sourced editorial artwork resilient when a remote image is
// slow or unavailable. Components with their own fallback remain unchanged;
// this capture-phase handler covers article covers and future content fields.
document.addEventListener('error', event => {
  const media = event.target as HTMLImageElement | HTMLVideoElement | null;
  if (!media || media.dataset.fallback) return;
  media.dataset.fallback = '1';
  if (media.tagName === 'IMG') {
    const image = media as HTMLImageElement;
    image.src = image.classList.contains('post-cover') ? '/xiaoyang-card-final-6.jpg' : '/xiaoyang-card-final-5.jpg';
  } else if (media.tagName === 'VIDEO') {
    const video = media as HTMLVideoElement;
    video.poster = '/xiaoyang-card-final-1.jpg';
    video.removeAttribute('autoplay');
    video.load();
  }
}, true);

// Detail-page hero visuals use the same cursor-following light treatment as
// the catalog tiles. Delegate the listener so it also works after route data
// mounts, while ignoring touch pointers.
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const visual = (event.target as HTMLElement | null)?.closest<HTMLElement>('.portfolio-work-visual');
  if (!visual) return;
  const rect = visual.getBoundingClientRect();
  visual.style.setProperty('--spot-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
  visual.style.setProperty('--spot-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
});
document.addEventListener('pointerout', event => {
  const visual = (event.target as HTMLElement | null)?.closest<HTMLElement>('.portfolio-work-visual');
  const next = event.relatedTarget as Node | null;
  if (visual && (!next || !visual.contains(next))) {
    visual.style.removeProperty('--spot-x');
    visual.style.removeProperty('--spot-y');
  }
});

// Editorial inner pages keep a quiet reading-progress rail so long case
// studies and notes retain the same navigational feedback as the home page.
if (routePath !== '/' && routePath !== '/admin') {
  const rail = document.createElement('div');
  rail.className = 'inner-scroll-progress';
  rail.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  rail.appendChild(fill);
  document.body.appendChild(rail);
  const syncProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.transform = `scaleY(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
  };
  addEventListener('scroll', syncProgress, { passive: true });
  addEventListener('resize', syncProgress, { passive: true });
  setTimeout(syncProgress, 0);
}

// Video posts are authored in the admin editor and need a first-class player
// on the public detail route as well. This small enhancer keeps the existing
// rich-content renderer intact while inserting the configured media before
// the article body after the page data is available.
if (routePath.startsWith('/writing/')) {
  const slug = decodeURIComponent(routePath.slice('/writing/'.length));
  fetch('/api/public/bootstrap').then(response => response.ok ? response.json() : null).then((payload: any) => {
    const post = payload?.posts?.find((item: any) => item.slug === slug);
    if (!post?.video_url || document.querySelector('.post-page .post-video')) return;
    const article = document.querySelector('.post-page');
    const body = article?.querySelector('.post-body');
    if (!article || !body) return;
    const video = document.createElement('video');
    video.className = 'post-cover post-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (post.cover_url) video.poster = post.cover_url;
    video.src = post.video_url;
    video.addEventListener('error', () => { video.dataset.failed = '1'; });
    article.insertBefore(video, body);
  }).catch(() => undefined);
}
