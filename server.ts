// Haze backend: a global background, optional per-project overrides (each its
// own image and settings, as in MonoCode), and the window glass settings.
import { randomBytes } from "node:crypto";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import {
  backgroundSettingsSchema,
  glassSchema,
  snapshotSchema,
  type Background,
  type Snapshot,
} from "./lib/model";

export type { Snapshot } from "./lib/model";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const GLOBAL = "global";
// "global" or a project id.
const target = z.string().min(1).max(200);

export const rpcContract = defineRpcContract({
  get: { input: z.null(), output: snapshotSchema },
  projects: { input: z.null(), output: z.array(z.object({ id: z.string(), name: z.string() })) },
  set: {
    input: z.object({ target, patch: backgroundSettingsSchema.partial().strict() }).strict(),
    output: snapshotSchema,
  },
  setImage: {
    // A data URL from the settings page, or null to remove the image.
    input: z.object({ target, dataUrl: z.string().max(9_000_000).nullable() }).strict(),
    output: snapshotSchema,
  },
  setGlass: { input: glassSchema.partial().strict(), output: snapshotSchema },
  // MonoCode's "Reset appearance": global settings, glass and image back to defaults.
  reset: { input: z.null(), output: snapshotSchema },
});

export const CHANGED = "changed";

type Row = { target: string; settings: string; mime: string | null; version: string | null };

export default function plugin(bb: BbPluginApi) {
  const db = bb.storage.database();
  bb.storage.migrate(db, [
    "CREATE TABLE haze (id INTEGER PRIMARY KEY CHECK (id = 1), settings TEXT NOT NULL, mime TEXT, version TEXT, bytes BLOB)",
    // v0.2: the single v0.1 background becomes the global one.
    "CREATE TABLE bg (target TEXT PRIMARY KEY, settings TEXT NOT NULL, mime TEXT, version TEXT, bytes BLOB)",
    "INSERT INTO bg (target, settings, mime, version, bytes) SELECT 'global', settings, mime, version, bytes FROM haze",
    "DROP TABLE haze",
    "CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  ]);
  db.prepare("INSERT OR IGNORE INTO bg (target, settings) VALUES ('global', '{}')").run();

  const imageUrl = (row: Row) =>
    row.version
      ? `/api/v1/plugins/haze/http/image?t=${encodeURIComponent(row.target)}&v=${row.version}`
      : null;
  const toBackground = (row: Row): Background => ({
    settings: backgroundSettingsSchema.parse(JSON.parse(row.settings)),
    imageUrl: imageUrl(row),
  });
  const readGlass = () => {
    const row = db.prepare("SELECT value FROM kv WHERE key = 'glass'").get() as { value: string } | undefined;
    return glassSchema.parse(row ? JSON.parse(row.value) : {});
  };

  function read(): Snapshot {
    const rows = db.prepare("SELECT target, settings, mime, version FROM bg").all() as Row[];
    const projects: Snapshot["projects"] = {};
    let global: Background | null = null;
    for (const row of rows) {
      if (row.target === GLOBAL) global = toBackground(row);
      else projects[row.target] = toBackground(row);
    }
    return { global: global!, projects, glass: readGlass() };
  }
  function changed(): Snapshot {
    bb.realtime.publish(CHANGED, null);
    return read();
  }
  function settingsOf(t: string) {
    const row = db.prepare("SELECT settings FROM bg WHERE target = ?").get(t) as { settings: string } | undefined;
    // A new project override starts from the global settings.
    return row ? backgroundSettingsSchema.parse(JSON.parse(row.settings)) : read().global.settings;
  }
  function ensureRow(t: string) {
    db.prepare("INSERT OR IGNORE INTO bg (target, settings) VALUES (?, ?)").run(t, JSON.stringify(settingsOf(t)));
  }

  function decode(dataUrl: string): { mime: string; bytes: Buffer } {
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    const mime = match?.[1];
    if (!match || !MIMES.includes(mime as (typeof MIMES)[number])) {
      throw new Error("Use a JPEG, PNG or WebP image.");
    }
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("The image must be under 6 MB.");
    }
    return { mime: mime!, bytes };
  }

  bb.rpc.register(rpcContract, {
    get: read,
    projects: async () => {
      const projects = await bb.sdk.projects.list({ includePersonal: true });
      return projects.map((p) => ({ id: p.id, name: p.name }));
    },
    set: ({ target: t, patch }) => {
      ensureRow(t);
      const next = backgroundSettingsSchema.parse({ ...settingsOf(t), ...patch });
      db.prepare("UPDATE bg SET settings = ? WHERE target = ?").run(JSON.stringify(next), t);
      return changed();
    },
    setImage: ({ target: t, dataUrl }) => {
      if (dataUrl === null) {
        // A project without its image is no override at all.
        if (t === GLOBAL) db.prepare("UPDATE bg SET mime = NULL, version = NULL, bytes = NULL WHERE target = ?").run(t);
        else db.prepare("DELETE FROM bg WHERE target = ?").run(t);
      } else {
        const { mime, bytes } = decode(dataUrl);
        ensureRow(t);
        db.prepare("UPDATE bg SET mime = ?, version = ?, bytes = ? WHERE target = ?")
          .run(mime, randomBytes(12).toString("hex"), bytes, t);
      }
      return changed();
    },
    setGlass: (patch) => {
      const next = glassSchema.parse({ ...readGlass(), ...patch });
      db.prepare("INSERT INTO kv (key, value) VALUES ('glass', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
        .run(JSON.stringify(next));
      return changed();
    },
    reset: () => {
      db.prepare("UPDATE bg SET settings = '{}', mime = NULL, version = NULL, bytes = NULL WHERE target = 'global'").run();
      db.prepare("DELETE FROM kv WHERE key = 'glass'").run();
      return changed();
    },
  });

  bb.http.route("GET", "/image", (c) => {
    const row = db.prepare("SELECT target, mime, version, bytes FROM bg WHERE target = ?").get(c.req.query("t") ?? GLOBAL) as
      (Row & { bytes: Buffer | null }) | undefined;
    // The version in the URL makes each image immutable and cacheable.
    if (!row?.bytes || !row.mime || c.req.query("v") !== row.version) return c.notFound();
    return new Response(new Uint8Array(row.bytes), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  });
}
