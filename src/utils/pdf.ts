import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function loadPdf(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  const buf = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  return task.promise;
}

export async function renderPdfPage(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  await page.render({ canvasContext: ctx, viewport }).promise;
}
