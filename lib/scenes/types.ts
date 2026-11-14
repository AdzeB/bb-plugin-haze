// A backdrop uses either Haze’s canvas runner or a self-contained SVG image.
// The runner in lib/backdrop.tsx owns sizing, motion and visibility.
import type { SceneId } from "../model";

export interface SceneInstance {
  /** The canvas changed size. Sizes are CSS pixels; `dpr` is device pixels per CSS pixel. */
  resize(width: number, height: number, dpr: number): void;
  /** Draws one frame, `time` seconds after the scene started. The context is scaled to CSS pixels. */
  draw(ctx: CanvasRenderingContext2D, time: number): void;
}

export type Scheme = "light" | "dark";

interface SceneMetadata {
  id: Exclude<SceneId, "none">;
  label: string;
  description: Record<Scheme, string>;
  /** A flat colour close to each version, shown before its first frame. */
  base: Record<Scheme, string>;
}

export type SceneDefinition = SceneMetadata & ({
  kind: "canvas";
  /** Frames per second while animating; scenes are slow, so 30 is plenty. */
  fps?: number;
  /** A fresh instance of one version; the same seed draws the same scene. */
  create(seed: number, scheme: Scheme): SceneInstance;
} | {
  kind: "svg";
  scheme: Scheme;
  twin: SceneMetadata["id"] | null;
  source: () => string | Promise<string>;
});

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
