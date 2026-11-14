// Settings shared by the server and the app. Names, ranges and defaults are
// MonoCode's (src/features/settings/model/appearance.ts).
import { z } from "zod";

export const EFFECTS = ["none", "dither", "ascii", "halftone", "scanlines", "gradient-blur"] as const;
export type Effect = (typeof EFFECTS)[number];

export const EFFECT_LABELS: Record<Effect, string> = {
  none: "None",
  dither: "Dither",
  ascii: "ASCII",
  halftone: "Halftone",
  scanlines: "Scanlines",
  "gradient-blur": "Haze",
};
export const EFFECT_DESCRIPTIONS: Record<Effect, string> = {
  none: "Shows the original artwork.",
  dither: "Rebuilds the artwork with a dithered color palette.",
  ascii: "Recreates the artwork with colored characters on black.",
  halftone: "Recreates the artwork with colored print dots on black.",
  scanlines: "Adds a pronounced horizontal display-line texture.",
  "gradient-blur": "Blurs and fades the artwork into the background below.",
};

export const OPACITY = { min: 0.05, max: 0.65, default: 0.24 };
export const SIDEBAR_OPACITY = { min: 0.15, max: 1, default: 0.85 };
/** The column wash behind the text, so a busy backdrop or full-screen image stays readable. */
export const VEIL = { min: 0, max: 0.8, default: 0.45 };
export const BLUR = { min: 1, max: 64, default: 24 };

const ranged = (range: { min: number; max: number; default: number }) =>
  z.number().transform((v) => Math.min(range.max, Math.max(range.min, v))).default(range.default);

export const backgroundSettingsSchema = z.object({
  // v0.1 stored "haze" / "plain"; they are MonoCode's gradient-blur / none.
  effect: z.preprocess(
    (v) => (v === "haze" ? "gradient-blur" : v === "plain" ? "none" : v),
    z.enum(EFFECTS),
  ).default("none"),
  scope: z.enum(["all", "empty"]).default("all"),
  emptyOpacity: ranged(OPACITY),
  sessionOpacity: ranged(OPACITY),
  // "top": MonoCode's haze that fades out before the text. "full": the image
  // fills the window behind every pane, edge to edge, like a backdrop scene.
  fill: z.enum(["top", "full"]).default("top"),
  veil: ranged(VEIL),
});
export type BackgroundSettings = z.infer<typeof backgroundSettingsSchema>;

/** MonoCode's window translucency, drawn over the background image instead of the desktop. */
export const glassSchema = z.object({
  enabled: z.boolean().default(true),
  sidebarOpacity: ranged(SIDEBAR_OPACITY),
  blur: ranged(BLUR),
  // MonoCode's "main pane glass": the workspace at 40% over the window.
  body: z.boolean().default(true),
});
export type Glass = z.infer<typeof glassSchema>;

/**
 * A live, drawn backdrop behind the whole window, like Claude Code's
 * `$.theme.set({ backdrop: { scene } })`. While a scene is on it replaces the
 * image background. Scene drawing lives in lib/scenes (browser only); these
 * are just the ids the server accepts.
 */
export const SCENES = ["none", "cloud-drift"] as const;
export type SceneId = (typeof SCENES)[number];

export const backdropSchema = z.object({
  // An id from a newer Haze falls back to no backdrop instead of failing.
  scene: z.enum(SCENES).catch("none").default("none"),
  // "scene": switch BB to the scene's light or dark scheme while it shows
  // (Claude Code's overrideColorScheme); "app": keep BB's own theme.
  colorScheme: z.enum(["scene", "app"]).default("scene"),
  veil: ranged(VEIL),
  motion: z.boolean().default(true),
});
export type Backdrop = z.infer<typeof backdropSchema>;

export const backgroundSchema = z.object({
  settings: backgroundSettingsSchema,
  imageUrl: z.string().nullable(),
});
export type Background = z.infer<typeof backgroundSchema>;

export const snapshotSchema = z.object({
  global: backgroundSchema,
  // Project overrides, by project id. Only ones with an image apply.
  projects: z.record(z.string(), backgroundSchema),
  glass: glassSchema,
  backdrop: backdropSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** The background a pane in `projectId` shows: its project's image when it has one. */
export function activeBackground(snapshot: Snapshot, projectId: string | null): Background {
  const project = projectId ? snapshot.projects[projectId] : undefined;
  return project?.imageUrl ? project : snapshot.global;
}
