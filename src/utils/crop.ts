import type { Rect } from '../types';

export function cropCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(source, Math.floor(rect.x), Math.floor(rect.y), w, h, 0, 0, w, h);
  return out;
}
