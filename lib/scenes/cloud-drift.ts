// Cloud Drift: a bright sky with ASCII cumulus clouds drifting across it and
// small flocks of birds flapping (v / ^) through. Each cloud is a grid of
// white character cells with a scatter of faint glyphs around its edge; a few
// glyphs change every half second so the clouds shimmer while they move.
import { pick, random, type SceneDefinition, type SceneInstance } from "./types";

const CW = 13; // cell width, CSS px
const CH = 18; // cell height
const PAD = 2; // halo cells around a cloud
const FONT = "500 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const BIRD_FONT = "600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const GLYPHS = [":", ":", ";", ";", ":", "t", "t", "%", "%", "'"];
const HALO = [".", ".", ",", "o", "°", ":", "'", "~"];

const SKY_TOP = "#68baee";
const SKY_BOTTOM = "#abddfa";
const CELL = "rgba(255, 255, 255, 0.94)";
const INK = "#97a3b0";
const BLUSH = "#d39ba5";
const HALO_INK = "rgba(255, 255, 255, 0.85)";
const BIRD_INK = "rgba(58, 98, 136, 0.6)";

const EMPTY = 0;
const CLOUD = 1;
const RIM = 2;

interface Cloud {
  band: number;
  x: number;
  y: number;
  speed: number;
  alpha: number;
  kind: Uint8Array; // padded grid, row-major
  glyph: string[];
  tint: Uint8Array;
  cols: number; // padded
  rows: number; // padded
  sprite: HTMLCanvasElement;
  nextFlicker: number;
}

interface Flock {
  x: number;
  baseY: number;
  vx: number;
  bob: number;
  birds: { dx: number; dy: number; phase: number }[];
}

function create(seed: number): SceneInstance {
  const rand = random(seed);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let clouds: Cloud[] = [];
  let flocks: Flock[] = [];
  let sky: CanvasGradient | null = null;
  let skyHeight = 0;
  let last: number | null = null;

  const bands = () => Math.max(4, Math.min(14, Math.round((width * height) / 150_000)));

  /** A cumulus outline: narrow at the top, widest below the middle, flat underneath. */
  function shape(cloud: Cloud) {
    const inner = 9 + Math.floor(rand() * 14);
    const innerRows = Math.max(3, Math.min(8, Math.round(inner * 0.32 + rand() * 2)));
    const cols = inner + PAD * 2;
    const rows = innerRows + PAD * 2;
    const kind = new Uint8Array(cols * rows);
    for (let r = 0; r < innerRows; r++) {
      const v = (r + 0.5) / innerRows;
      const profile = v < 0.65 ? Math.sin((v / 0.65) * (Math.PI / 2)) : 1 - ((v - 0.65) / 0.35) * 0.3;
      const half = (inner / 2) * (0.3 + 0.7 * profile) + (rand() - 0.5) * 1.6;
      const center = inner / 2 + (rand() - 0.5) * 2;
      for (let c = 0; c < inner; c++) {
        if (Math.abs(c + 0.5 - center) <= half) kind[(r + PAD) * cols + c + PAD] = CLOUD;
      }
    }
    // The rim: empty cells within PAD of the cloud, where faint glyphs may appear.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (kind[r * cols + c] !== EMPTY) continue;
        search: for (let dr = -PAD; dr <= PAD; dr++) {
          for (let dc = -PAD; dc <= PAD; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && kind[rr * cols + cc] === CLOUD) {
              kind[r * cols + c] = RIM;
              break search;
            }
          }
        }
      }
    }
    cloud.cols = cols;
    cloud.rows = rows;
    cloud.kind = kind;
    cloud.glyph = new Array<string>(cols * rows).fill("");
    cloud.tint = new Uint8Array(cols * rows);
    roll(cloud, 1);
  }

  /** Re-picks `share` of the glyphs. */
  function roll(cloud: Cloud, share: number) {
    for (let i = 0; i < cloud.kind.length; i++) {
      if (cloud.kind[i] === EMPTY || rand() > share) continue;
      if (cloud.kind[i] === CLOUD) {
        cloud.glyph[i] = pick(rand, GLYPHS);
        cloud.tint[i] = rand() < 0.05 ? 1 : 0;
      } else {
        cloud.glyph[i] = rand() < 0.2 ? pick(rand, HALO) : "";
      }
    }
  }

  function render(cloud: Cloud) {
    const sprite = cloud.sprite;
    sprite.width = Math.ceil(cloud.cols * CW * dpr);
    sprite.height = Math.ceil(cloud.rows * CH * dpr);
    const ctx = sprite.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < cloud.rows; r++) {
      for (let c = 0; c < cloud.cols; c++) {
        const i = r * cloud.cols + c;
        const x = c * CW;
        const y = r * CH;
        if (cloud.kind[i] === CLOUD) {
          ctx.fillStyle = CELL;
          ctx.fillRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
          ctx.fillStyle = cloud.tint[i] ? BLUSH : INK;
          ctx.fillText(cloud.glyph[i]!, x + CW / 2, y + CH / 2 + 0.5);
        } else if (cloud.glyph[i]) {
          ctx.fillStyle = HALO_INK;
          ctx.fillText(cloud.glyph[i]!, x + CW / 2, y + CH / 2 + 0.5);
        }
      }
    }
  }

  function place(cloud: Cloud, entering: boolean) {
    const bandHeight = height / bands();
    const h = cloud.rows * CH;
    const w = cloud.cols * CW;
    cloud.y = cloud.band * bandHeight + rand() * Math.max(0, bandHeight - h * 0.6) - h * 0.2;
    cloud.x = entering ? -w - rand() * width * 0.25 : rand() * (width + w) - w;
  }

  function makeCloud(band: number): Cloud {
    const depth = rand();
    const cloud: Cloud = {
      band,
      x: 0,
      y: 0,
      speed: 7 + depth * 11,
      alpha: 0.7 + depth * 0.3,
      kind: new Uint8Array(0),
      glyph: [],
      tint: new Uint8Array(0),
      cols: 0,
      rows: 0,
      sprite: document.createElement("canvas"),
      nextFlicker: rand() * 0.5,
    };
    shape(cloud);
    render(cloud);
    place(cloud, false);
    return cloud;
  }

  function makeFlock(entering: boolean): Flock {
    const count = 2 + Math.floor(rand() * 4);
    return {
      x: entering ? -90 - rand() * width * 0.6 : rand() * width,
      baseY: height * (0.08 + rand() * 0.55),
      vx: 16 + rand() * 14,
      bob: rand() * Math.PI * 2,
      birds: Array.from({ length: count }, (_, i) => ({
        dx: i * 16 + rand() * 18,
        dy: Math.abs(i - (count - 1) / 2) * 14 + rand() * 10,
        phase: rand() * Math.PI * 2,
      })),
    };
  }

  function build() {
    // One cloud per horizontal band, each at a random x, so the sky fills evenly.
    clouds = Array.from({ length: bands() }, (_, band) => makeCloud(band));
    clouds.sort((a, b) => a.alpha - b.alpha); // far (fainter) clouds first
    flocks = Array.from({ length: width > 900 ? 2 : 1 }, () => makeFlock(false));
  }

  return {
    resize(w, h, ratio) {
      const scaleX = width ? w / width : 1;
      const scaleY = height ? h / height : 1;
      const rebuild = !clouds.length || Math.max(4, Math.min(14, Math.round((w * h) / 150_000))) !== clouds.length;
      const rerender = ratio !== dpr;
      width = w;
      height = h;
      dpr = ratio;
      if (rebuild) return build();
      for (const cloud of clouds) {
        cloud.x *= scaleX;
        cloud.y *= scaleY;
        if (rerender) render(cloud);
      }
      for (const flock of flocks) {
        flock.x *= scaleX;
        flock.baseY *= scaleY;
      }
    },

    draw(ctx, time) {
      const dt = last === null ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;

      if (!sky || skyHeight !== height) {
        sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, SKY_TOP);
        sky.addColorStop(1, SKY_BOTTOM);
        skyHeight = height;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      for (const cloud of clouds) {
        cloud.x += cloud.speed * dt;
        if (cloud.x > width) {
          shape(cloud);
          render(cloud);
          place(cloud, true);
        } else if (dt > 0 && time >= cloud.nextFlicker) {
          roll(cloud, 0.12);
          render(cloud);
          cloud.nextFlicker = time + 0.35 + rand() * 0.3;
        }
        ctx.globalAlpha = cloud.alpha;
        // Whole device pixels keep the glyphs sharp.
        const x = Math.round(cloud.x * dpr) / dpr;
        const y = Math.round(cloud.y * dpr) / dpr;
        ctx.drawImage(cloud.sprite, x, y, cloud.cols * CW, cloud.rows * CH);
      }

      ctx.globalAlpha = 1;
      ctx.font = BIRD_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = BIRD_INK;
      flocks = flocks.map((flock) => {
        flock.x += flock.vx * dt;
        if (flock.x > width + 120) return makeFlock(true);
        const y = flock.baseY + Math.sin(time * 0.6 + flock.bob) * 6;
        for (const bird of flock.birds) {
          const up = Math.sin(time * 6 + bird.phase) > 0;
          ctx.fillText(up ? "^" : "v", Math.round(flock.x + bird.dx), Math.round(y + bird.dy));
        }
        return flock;
      });
    },
  };
}

export const cloudDrift: SceneDefinition = {
  id: "cloud-drift",
  label: "Cloud Drift",
  description: "ASCII clouds drift across a bright sky while birds flap past.",
  colorScheme: "light",
  base: "#8ccbf3",
  fps: 30,
  create,
};
