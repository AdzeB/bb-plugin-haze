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

export interface SceneDefinition {
  id: Exclude<SceneId, "none">;
  label: string;
  description: string;
  /** The BB colour scheme the scene is painted for (Claude Code's overrideColorScheme). */
  colorScheme: "light" | "dark";
  /** A flat colour close to the scene, shown before its first frame. */
  base: string;
  /** Frames per second while animating; scenes are slow, so 30 is plenty. */
  fps?: number;
  /** A fresh instance; the same seed draws the same scene. */
  create(seed: number): SceneInstance;
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
