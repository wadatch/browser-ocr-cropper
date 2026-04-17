import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(['jpn', 'eng']).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  return data.text;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise;
  workerPromise = null;
  await w.terminate();
}
