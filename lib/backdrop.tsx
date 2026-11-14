// Runs scenes: a canvas, its size, the frame loop, the reveal between scenes,
// and the colour-scheme override. The CSS that makes BB's panes transparent
// over the canvas is in app.css (html[data-haze-backdrop]).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { SceneDefinition } from "./scenes";
import type { Scheme } from "./scenes/types";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Draws `scene` to fill its canvas. `scale` < 1 draws a smaller copy of the
 * full-size scene (settings thumbnails). Stops drawing while the window is
 * hidden, and draws one still frame when motion is off or reduced.
 */
export function SceneCanvas({
  scene,
  scheme,
  animate,
  scale = 1,
  seed = 7,
  className,
  style,
  reveal,
  onRevealed,
}: {
  scene: SceneDefinition;
  scheme: Scheme;
  animate: boolean;
  scale?: number;
  seed?: number;
  className?: string;
  style?: CSSProperties;
  reveal?: boolean;
  onRevealed?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const instance = scene.create(seed, scheme);
    const reduced = window.matchMedia(REDUCED_MOTION);
    const interval = 1000 / (scene.fps ?? 30);
    const start = performance.now();
    let size = { width: 0, height: 0, dpr: 0 };
    let frame = 0;
    let lastDraw = -Infinity;

    // Hidden (display: none, e.g. on the Settings screen): keep the scene as it is and stop drawing.
    const hidden = () => canvas.getClientRects().length === 0;
    const measure = () => {
      if (hidden()) return false;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, rect.width / scale);
      const height = Math.max(1, rect.height / scale);
      if (width === size.width && height === size.height && dpr === size.dpr) return false;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      size = { width, height, dpr };
      instance.resize(width, height, dpr * scale);
      return true;
    };
    const draw = (now: number) => {
      ctx.setTransform(size.dpr * scale, 0, 0, size.dpr * scale, 0, 0);
      instance.draw(ctx, (now - start) / 1000);
      lastDraw = now;
    };
    const moving = () => animate && !reduced.matches && !document.hidden && !hidden();
    const tick = (now: number) => {
      frame = 0;
      if (!moving()) return;
      frame = requestAnimationFrame(tick);
      if (now - lastDraw >= interval - 2) draw(now);
    };
    const resume = () => {
      if (!frame && moving()) frame = requestAnimationFrame(tick);
    };
    const redraw = () => {
      measure();
      if (!hidden()) draw(performance.now());
      resume();
    };

    const observer = new ResizeObserver(() => {
      if (measure()) draw(performance.now());
      resume(); // shown again after being hidden
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", redraw);
    redraw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", redraw);
    };
  }, [scene, scheme, animate, scale, seed]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={style}
      data-reveal={reveal || undefined}
      onAnimationEnd={onRevealed}
    />
  );
}

type Layer = { key: number; scene: SceneDefinition; scheme: Scheme; reveal: boolean };

/**
 * The window backdrop: a fixed canvas behind all of BB. A new scene opens in
 * a widening circle over the old one, which is dropped once it is covered.
 */
export function BackdropLayer({
  scene,
  scheme,
  animate,
  reveal,
}: {
  scene: SceneDefinition;
  scheme: Scheme;
  animate: boolean;
  reveal: boolean;
}) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ key: 0, scene, scheme, reveal }]);
  // A new scene, or the other version of this one (day to night), opens over the last.
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1]!;
      if (top.scene.id === scene.id && top.scheme === scheme) return prev;
      return [top, { key: top.key + 1, scene, scheme, reveal: true }];
    });
  }, [scene, scheme]);
  return createPortal(
    <div className="haze-backdrop" aria-hidden="true">
      {layers.map((layer) => (
        <SceneCanvas
          key={layer.key}
          className="haze-backdrop-layer"
          scene={layer.scene}
          scheme={layer.scheme}
          animate={animate}
          reveal={layer.reveal}
          onRevealed={() => setLayers((prev) => prev.filter((other) => other.key >= layer.key))}
        />
      ))}
    </div>,
    document.body,
  );
}

/**
 * A chat background image filling the window behind every pane (Fill: Full
 * screen). `url` already carries the pixel effect; the Haze effect blurs it.
 */
export function ImageBackdrop({ url, haze }: { url: string; haze: boolean }) {
  return createPortal(
    <div className="haze-backdrop" aria-hidden="true">
      <div
        key={url}
        className="haze-backdrop-layer haze-backdrop-image"
        data-effect={haze ? "haze" : undefined}
        style={{ backgroundImage: `url("${url}")` }}
      />
    </div>,
    document.body,
  );
}

/**
 * Holds BB in `scheme` while a scene that is painted for it shows, the way
 * Claude Code's overrideColorScheme does, and hands the theme back after.
 * BB marks dark mode with the `dark` class on <html>. Whenever BB sets it (a
 * theme change, the system going dark) this notes what BB wanted and flips it
 * straight back; turning the scene off restores the last thing BB wanted.
 */
export function useColorSchemeOverride(scheme: "light" | "dark" | null): void {
  useEffect(() => {
    if (!scheme) return;
    const root = document.documentElement;
    const dark = scheme === "dark";
    let bbDark = root.classList.contains("dark");
    const apply = () => {
      const current = root.classList.contains("dark");
      if (current === dark) return;
      bbDark = current;
      root.classList.toggle("dark", dark);
    };
    apply();
    root.dataset.hazeScheme = scheme;
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      delete root.dataset.hazeScheme;
      root.classList.toggle("dark", bbDark);
    };
  }, [scheme]);
}
