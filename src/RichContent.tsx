import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function normalizeRichText(value = '') {
  const trimmed = value.trim();
  if (!trimmed) return '<p></p>';
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed.split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`).join('');
}

export function sanitizeRichText(value = '') {
  const clean = DOMPurify.sanitize(normalizeRichText(value), {
    ADD_TAGS: ['iframe', 'video', 'source'],
    ADD_ATTR: ['allowfullscreen', 'controls', 'playsinline', 'preload', 'poster', 'frameborder'],
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form'],
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  doc.querySelectorAll('iframe').forEach(frame => {
    const src = frame.getAttribute('src') || '';
    if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//i.test(src)) frame.remove();
  });
  doc.querySelectorAll('a').forEach(link => {
    link.setAttribute('rel', 'noopener noreferrer');
    if (/^https?:/i.test(link.href)) link.setAttribute('target', '_blank');
  });
  return doc.body.innerHTML;
}

export function RichContent({ html, className = '' }:{ html: string; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      image.addEventListener('error', () => {
        if (image.dataset.fallback) return;
        image.dataset.fallback = '1';
        image.src = '/xiaoyang-card-final-5.jpg';
      }, { once: true });
    });
    root.querySelectorAll<HTMLVideoElement>('video').forEach(video => {
      video.addEventListener('error', () => {
        if (video.dataset.fallback) return;
        video.dataset.fallback = '1';
        video.poster = '/xiaoyang-card-final-6.jpg';
        video.removeAttribute('src');
        video.load();
      }, { once: true });
    });
  }, [html]);
  return <div ref={rootRef} className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}
