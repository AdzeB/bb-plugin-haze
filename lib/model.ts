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
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** The background a pane in `projectId` shows: its project's image when it has one. */
export function activeBackground(snapshot: Snapshot, projectId: string | null): Background {
  const project = projectId ? snapshot.projects[projectId] : undefined;
  return project?.imageUrl ? project : snapshot.global;
}
