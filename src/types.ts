import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRSelection {
  id: string;
  pageIndex: number;
  label: string;
  /** Coordinates are in canvas-internal pixels for the page render at the time of creation. */
  rect: Rect;
}

export type OCRStatus = 'idle' | 'running' | 'done' | 'error';

export interface OCRResult {
  status: OCRStatus;
  text: string;
  error?: string;
}

export interface ImageSource {
  kind: 'image';
  bitmap: ImageBitmap;
  pageCount: 1;
}

export interface PdfSource {
  kind: 'pdf';
  doc: PDFDocumentProxy;
  pageCount: number;
}

export type LoadedSource = ImageSource | PdfSource;
