// A scene is a live backdrop Haze draws on a canvas behind the whole window,
// like a Claude Code mod's `Backdrop` render site. Scenes only draw; the
// runner (lib/backdrop.tsx) owns the canvas, its size and the frame loop.
import type { SceneId } from "../model";

export interface SceneInstance {
  /** The canvas changed size. Sizes are CSS pixels; `dpr` is device pixels per CSS pixel. */
  resize(width: number, height: number, dpr: number): void;
  /** Draws one frame, `time` seconds after the scene started. The context is scaled to CSS pixels. */
  draw(ctx: CanvasRenderingContext2D, time: number): void;
}

export type Scheme = "light" | "dark";

/** Every scene comes in a light and a dark version, drawn for BB's matching theme. */
export interface SceneDefinition {
  id: Exclude<SceneId, "none">;
  label: string;
  description: Record<Scheme, string>;
  /** A flat colour close to each version, shown before its first frame. */
  base: Record<Scheme, string>;
  /** Frames per second while animating; scenes are slow, so 30 is plenty. */
  fps?: number;
  /** A fresh instance of one version; the same seed draws the same scene. */
  create(seed: number, scheme: Scheme): SceneInstance;
}

/** Small deterministic PRNG (mulberry32), so thumbnails and reloads look the same. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
