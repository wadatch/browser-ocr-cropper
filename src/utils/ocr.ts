import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { WritingMode } from '../types';

const workers: Partial<Record<WritingMode, Promise<Worker>>> = {};

function langsFor(mode: WritingMode): string[] {
  return mode === 'vertical' ? ['jpn_vert'] : ['jpn', 'eng'];
}

export function getOcrWorker(mode: WritingMode = 'horizontal'): Promise<Worker> {
  let promise = workers[mode];
  if (!promise) {
    promise = (async () => {
      const worker = await createWorker(langsFor(mode));
      // jpn_vert needs the vertical-block PSM, otherwise it tries to read
      // the columns as horizontal lines and accuracy collapses.
      await worker.setParameters({
        tessedit_pageseg_mode:
          mode === 'vertical' ? PSM.SINGLE_BLOCK_VERT_TEXT : PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((err) => {
      workers[mode] = undefined;
      throw err;
    });
    workers[mode] = promise;
  }
  return promise;
}

export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  opts: { writingMode?: WritingMode } = {},
): Promise<string> {
  const worker = await getOcrWorker(opts.writingMode ?? 'horizontal');
  const { data } = await worker.recognize(canvas);
  return normalizeOcrText(data.text);
}

// CJK characters often get spurious spaces inserted between them by Tesseract.
// Collapse spaces/tabs that sit between two CJK chars; leave ASCII word spacing alone.
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\u3000-\\u303F\\uFF00-\\uFFEF';
const INTER_CJK_SPACE = new RegExp(`(?<=[${CJK}])[ \\t]+(?=[${CJK}])`, 'gu');

export function normalizeOcrText(text: string): string {
  let prev: string;
  let cur = text;
  do {
    prev = cur;
    cur = cur.replace(INTER_CJK_SPACE, '');
  } while (cur !== prev);
  return cur;
}

export async function terminateOcrWorker(): Promise<void> {
  const pending = (Object.keys(workers) as WritingMode[]).map(async (mode) => {
    const p = workers[mode];
    workers[mode] = undefined;
    if (p) (await p).terminate();
  });
  await Promise.all(pending);
}
