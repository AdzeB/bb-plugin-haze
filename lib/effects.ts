// MonoCode's background effects (newThreadBackgroundEffects.worker.ts), run
// in a Web Worker built from this function's source so the bundle stays one
// file. workerMain must stay self-contained: it can reference nothing outside.
import type { Effect } from "./model";

function workerMain() {
  type Source = { width: number; height: number; pixels: Uint8ClampedArray; luma: Uint8Array };
  const sources = new Map<string, Source>();

  const coverIndex = (s: Source, x: number, y: number) =>
    Math.max(0, Math.min(s.height - 1, Math.floor(y))) * s.width +
    Math.max(0, Math.min(s.width - 1, Math.floor(x)));

  function ditherColor(r: number, g: number, b: number, a: number, threshold: number) {
    const peak = Math.max(r, g, b);
    const bright = peak / 255 > (threshold + 0.5) / 16;
    const gain = bright ? 255 / Math.max(peak, 1) : 0.08;
    return [Math.round(r * gain), Math.round(g * gain), Math.round(b * gain), a];
  }

  function dither(s: Source) {
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const out = new Uint8ClampedArray(s.pixels.length);
    for (let y = 0; y < s.height; y += 2) {
      for (let x = 0; x < s.width; x += 2) {
        const base = coverIndex(s, Math.min(x + 1, s.width - 1), Math.min(y + 1, s.height - 1)) * 4;
        const color = ditherColor(s.pixels[base]!, s.pixels[base + 1]!, s.pixels[base + 2]!, s.pixels[base + 3]!,
          bayer[Math.floor(y / 2) % 4]![Math.floor(x / 2) % 4]!);
        for (let dy = 0; dy < Math.min(2, s.height - y); dy += 1) {
          for (let dx = 0; dx < Math.min(2, s.width - x); dx += 1) out.set(color, ((y + dy) * s.width + x + dx) * 4);
        }
      }
    }
    return out;
  }

  function ascii(s: Source, light: boolean) {
    const glyphs = [
      [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 4, 0], [0, 4, 0, 0, 4, 0, 0], [0, 0, 0, 14, 0, 0, 0],
      [0, 0, 14, 0, 14, 0, 0], [0, 4, 4, 31, 4, 4, 0], [0, 21, 14, 31, 14, 21, 0],
      [10, 10, 31, 10, 31, 10, 10], [17, 2, 4, 4, 8, 16, 17], [14, 17, 23, 21, 23, 16, 14],
    ];
    const out = new Uint8ClampedArray(s.pixels.length);
    const paper = light ? 255 : 0;
    for (let y = 0; y < s.height; y += 1) {
      for (let x = 0; x < s.width; x += 1) {
        const sample = coverIndex(s, Math.min(Math.floor(x / 6) * 6 + 3, s.width - 1), Math.min(Math.floor(y / 8) * 8 + 4, s.height - 1));
        const density = light ? 255 - s.luma[sample]! : s.luma[sample]!;
        const glyph = glyphs[Math.floor(Math.sqrt(density / 255) * 9)]!;
        const ink = x % 6 < 5 && y % 8 < 7 && (glyph[y % 8]! & (1 << (4 - (x % 6)))) !== 0;
        const pixel = (y * s.width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const texture = ink ? s.pixels[sample * 4 + c]! : paper;
          out[pixel + c] = s.pixels[pixel + c]! * 0.6 + texture * 0.4;
        }
        out[pixel + 3] = s.pixels[pixel + 3]!;
      }
    }
    return out;
  }

  function halftone(s: Source, light: boolean) {
    const out = new Uint8ClampedArray(s.pixels.length);
    const paper = light ? 255 : 0;
    out.fill(paper);
    for (let a = 3; a < out.length; a += 4) out[a] = 255;
    for (let y = 0; y < s.height; y += 4) {
      for (let x = 0; x < s.width; x += 4) {
        const sampled = s.luma[coverIndex(s, x, y)]!;
        const luma = light ? 255 - sampled : sampled;
        const radius = 2 * (0.3 + 0.7 * Math.sqrt(luma / 255));
        const dot = coverIndex(s, Math.min(x + 2, s.width - 1), Math.min(y + 2, s.height - 1)) * 4;
        for (let dy = 0; dy < Math.min(4, s.height - y); dy += 1) {
          for (let dx = 0; dx < Math.min(4, s.width - x); dx += 1) {
            const p = ((y + dy) * s.width + x + dx) * 4;
            const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(dx - 1.5, dy - 1.5))) * (s.pixels[dot + 3]! / 255);
            for (let c = 0; c < 3; c += 1) {
              const texture = s.pixels[dot + c]! * coverage + paper * (1 - coverage);
              out[p + c] = s.pixels[p + c]! * 0.6 + texture * 0.4;
            }
            out[p + 3] = s.pixels[p + 3]!;
          }
        }
      }
    }
    return out;
  }

  function scanlines(s: Source, light: boolean) {
    const out = new Uint8ClampedArray(s.pixels.length);
    for (let y = 0; y < s.height; y += 1) {
      const gain = y % 3 === 0 ? 0.52 : 1;
      for (let x = 0; x < s.width; x += 1) {
        const p = (y * s.width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const v = s.pixels[p + c]!;
          out[p + c] = light ? v + (255 - v) * (1 - gain) : v * gain;
        }
        out[p + 3] = s.pixels[p + 3]!;
      }
    }
    return out;
  }

  async function load(url: string): Promise<Source> {
    const cached = sources.get(url);
    if (cached) return cached;
    const decoded = await createImageBitmap(await (await fetch(url, { credentials: "same-origin" })).blob());
    const scale = Math.min(1, 2048 / decoded.width, 2048 / decoded.height);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const context = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true })!;
    context.drawImage(decoded, 0, 0, width, height);
    decoded.close();
    const pixels = context.getImageData(0, 0, width, height).data;
    const luma = new Uint8Array(width * height);
    for (let i = 0; i < luma.length; i += 1) {
      luma[i] = Math.round(pixels[i * 4]! * 0.2126 + pixels[i * 4 + 1]! * 0.7152 + pixels[i * 4 + 2]! * 0.0722);
    }
    const source = { width, height, pixels, luma };
    sources.clear(); // one image at a time is enough; the main thread caches results
    sources.set(url, source);
    return source;
  }

  self.onmessage = async (event: MessageEvent<{ id: number; url: string; effect: string; light: boolean }>) => {
    const { id, url, effect, light } = event.data;
    try {
      const s = await load(url);
      const pixels = effect === "dither" ? dither(s) : effect === "ascii" ? ascii(s, light)
        : effect === "halftone" ? halftone(s, light) : scanlines(s, light);
      const canvas = new OffscreenCanvas(s.width, s.height);
      canvas.getContext("2d")!.putImageData(new ImageData(pixels, s.width, s.height), 0, 0);
      self.postMessage({ id, blob: await canvas.convertToBlob({ type: "image/png" }) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  };
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (url: string) => void; reject: (error: Error) => void }>();
const cache = new Map<string, Promise<string>>();

function getWorker(): Worker {
  if (worker) return worker;
  const source = URL.createObjectURL(new Blob([`(${workerMain.toString()})()`], { type: "text/javascript" }));
  worker = new Worker(source);
  URL.revokeObjectURL(source);
  worker.onmessage = ({ data }: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
    const request = pending.get(data.id);
    pending.delete(data.id);
    if (data.blob) request?.resolve(URL.createObjectURL(data.blob));
    else request?.reject(new Error(data.error ?? "Effect failed"));
  };
  return worker;
}

/** Effects that recolour pixels; the others are pure CSS over the original. */
export const needsWorker = (effect: Effect) =>
  effect === "dither" || effect === "ascii" || effect === "halftone" || effect === "scanlines";

/** An object URL of `url` with `effect` applied. Results are cached per image, effect and theme. */
export function renderEffect(url: string, effect: Effect, light: boolean): Promise<string> {
  // Dither ignores the theme, as in MonoCode.
  const key = `${url}|${effect}|${effect !== "dither" && light}`;
  let result = cache.get(key);
  if (!result) {
    result = new Promise<string>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, url: new URL(url, location.href).href, effect, light });
    });
    result.catch(() => cache.delete(key)); // a failure stays retryable
    cache.set(key, result);
  }
  return result;
}

export function disposeEffects(): void {
  worker?.terminate();
  worker = null;
  for (const result of cache.values()) void result.then(URL.revokeObjectURL, () => {});
  cache.clear();
  pending.clear();
}
