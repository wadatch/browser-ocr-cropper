import type { Quad, WritingMode } from '../types';

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  return ctx;
}

function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  getCtx(out).drawImage(canvas, 0, 0);
  return out;
}

export function toGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(canvas);
  const ctx = getCtx(out);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Otsu's method for adaptive black/white binarization. */
export function binarizeOtsu(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const gray = toGrayscale(canvas);
  const ctx = getCtx(gray);
  const img = ctx.getImageData(0, 0, gray.width, gray.height);
  const d = img.data;

  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;

  const total = gray.width * gray.height;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > varMax) {
      varMax = v;
      threshold = t;
    }
  }

  let blackCount = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
    if (v === 0) blackCount++;
  }
  // Tesseract expects dark text on a bright background. If the threshold
  // produced a black-dominant image (e.g. light text on a dark page, or low
  // overall brightness), invert so the background ends up white.
  if (blackCount * 2 > total) {
    for (let i = 0; i < d.length; i += 4) {
      const v = 255 - d[i];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  return gray;
}

function rotateCanvas(canvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = canvas.width;
  const h = canvas.height;
  const newW = Math.max(1, Math.ceil(w * cos + h * sin));
  const newH = Math.max(1, Math.ceil(w * sin + h * cos));
  const out = document.createElement('canvas');
  out.width = newW;
  out.height = newH;
  const ctx = getCtx(out);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

/**
 * Score = variance of dark-pixel projections across the axis perpendicular to text lines.
 * For horizontal text we project onto rows; for vertical text, onto columns.
 * Higher variance means clearer separation between text bands and gaps -> better deskew.
 */
function projectionVariance(
  canvas: HTMLCanvasElement,
  mode: WritingMode,
): number {
  const ctx = getCtx(canvas);
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;

  if (mode === 'vertical') {
    const colSums = new Array<number>(width).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (d[(y * width + x) * 4] < 128) colSums[x]++;
      }
    }
    return variance(colSums);
  }

  const rowSums = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    let s = 0;
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (d[base + x * 4] < 128) s++;
    }
    rowSums[y] = s;
  }
  return variance(rowSums);
}

function variance(arr: number[]): number {
  const n = arr.length;
  if (n === 0) return 0;
  let mean = 0;
  for (const v of arr) mean += v;
  mean /= n;
  let acc = 0;
  for (const v of arr) acc += (v - mean) ** 2;
  return acc / n;
}

/**
 * Auto-deskew using projection-profile search over a small angle range.
 * Returns a new canvas with text rotated upright. Returns the input unchanged
 * if the detected angle is too small to matter or the crop is too small to be reliable.
 */
export function deskew(
  canvas: HTMLCanvasElement,
  mode: WritingMode = 'horizontal',
  rangeDeg = 8,
  stepDeg = 1,
): HTMLCanvasElement {
  if (canvas.width < 40 || canvas.height < 40) return canvas;
  const bin = binarizeOtsu(canvas);

  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let angle = -rangeDeg; angle <= rangeDeg + 1e-9; angle += stepDeg) {
    const rotated = rotateCanvas(bin, angle);
    const score = projectionVariance(rotated, mode);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  if (Math.abs(bestAngle) < 0.5) return canvas;
  return rotateCanvas(canvas, bestAngle);
}

/** Solve an 8x8 linear system using Gaussian elimination with partial pivoting. */
function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    }
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) throw new Error('Singular matrix');
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  // After Gauss-Jordan elimination row i has only diagonal element row[i] and
  // the RHS row[n] non-zero, so the solution is row[n] / row[i].
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Solve homography H so that H * src_i = dst_i (in homogeneous coords) for i = 0..3.
 * Returns 9-element row-major matrix with H[8] = 1.
 */
function solveHomography(src: Quad, dst: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [xs, ys] = src[i];
    const [xd, yd] = dst[i];
    A.push([xs, ys, 1, 0, 0, 0, -xs * xd, -ys * xd]);
    b.push(xd);
    A.push([0, 0, 0, xs, ys, 1, -xs * yd, -ys * yd]);
    b.push(yd);
  }
  const h = gaussianSolve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Warp a quadrilateral region of `source` into an axis-aligned rectangle.
 * Quad order: [TL, TR, BR, BL]. Output dimensions are derived from the average
 * of opposite edge lengths to roughly preserve the aspect ratio.
 */
export function perspectiveWarp(source: HTMLCanvasElement, srcQuad: Quad): HTMLCanvasElement {
  const widthTop = dist(srcQuad[0], srcQuad[1]);
  const widthBot = dist(srcQuad[3], srcQuad[2]);
  const heightLeft = dist(srcQuad[0], srcQuad[3]);
  const heightRight = dist(srcQuad[1], srcQuad[2]);
  const destW = Math.max(1, Math.round((widthTop + widthBot) / 2));
  const destH = Math.max(1, Math.round((heightLeft + heightRight) / 2));

  // For inverse mapping we need: output (x,y) -> source (sx, sy).
  const outCorners: Quad = [
    [0, 0],
    [destW, 0],
    [destW, destH],
    [0, destH],
  ];
  const H = solveHomography(outCorners, srcQuad);

  const out = document.createElement('canvas');
  out.width = destW;
  out.height = destH;
  const outCtx = getCtx(out);
  const outImg = outCtx.createImageData(destW, destH);
  const od = outImg.data;

  const srcCtx = getCtx(source);
  const srcImg = srcCtx.getImageData(0, 0, source.width, source.height);
  const sd = srcImg.data;
  const sw = source.width;
  const sh = source.height;

  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const denom = H[6] * x + H[7] * y + H[8];
      const sx = (H[0] * x + H[1] * y + H[2]) / denom;
      const sy = (H[3] * x + H[4] * y + H[5]) / denom;
      const isx = sx | 0;
      const isy = sy | 0;
      const oi = (y * destW + x) * 4;
      if (isx >= 0 && isx < sw && isy >= 0 && isy < sh) {
        const si = (isy * sw + isx) * 4;
        od[oi] = sd[si];
        od[oi + 1] = sd[si + 1];
        od[oi + 2] = sd[si + 2];
        od[oi + 3] = 255;
      } else {
        od[oi] = od[oi + 1] = od[oi + 2] = 255;
        od[oi + 3] = 255;
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return out;
}
