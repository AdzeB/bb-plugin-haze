// Haze backend: one background (settings + one image) shared by every window.
import { randomBytes } from "node:crypto";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const settingsSchema = z.object({
  // "haze" = MonoCode's gradient-blur look; "plain" = the image, faded only.
  effect: z.enum(["haze", "plain"]).default("haze"),
  // MonoCode's defaults: 24% on both the empty session and the conversation.
  emptyOpacity: z.number().min(0).max(1).default(0.24),
  sessionOpacity: z.number().min(0).max(1).default(0.24),
  scope: z.enum(["all", "empty"]).default("all"),
});
export type HazeSettings = z.infer<typeof settingsSchema>;

const snapshotSchema = z.object({
  settings: settingsSchema,
  imageUrl: z.string().nullable(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export const rpcContract = defineRpcContract({
  get: { input: z.null(), output: snapshotSchema },
  set: { input: settingsSchema.partial().strict(), output: snapshotSchema },
  setImage: {
    // A data URL from the settings page, or null to remove the image.
    input: z.object({ dataUrl: z.string().max(9_000_000).nullable() }).strict(),
    output: snapshotSchema,
  },
});

export const CHANGED = "changed";

type Row = { settings: string; mime: string | null; version: string | null };

export default function plugin(bb: BbPluginApi) {
  const db = bb.storage.database();
  bb.storage.migrate(db, [
    "CREATE TABLE haze (id INTEGER PRIMARY KEY CHECK (id = 1), settings TEXT NOT NULL, mime TEXT, version TEXT, bytes BLOB)",
  ]);
  db.prepare("INSERT OR IGNORE INTO haze (id, settings) VALUES (1, '{}')").run();

  function read(): Snapshot {
    const row = db.prepare("SELECT settings, mime, version FROM haze WHERE id = 1").get() as Row;
    return {
      settings: settingsSchema.parse(JSON.parse(row.settings)),
      imageUrl: row.version ? `/api/v1/plugins/haze/http/image?v=${row.version}` : null,
    };
  }
  function changed(): Snapshot {
    bb.realtime.publish(CHANGED, null);
    return read();
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
    set: (patch) => {
      const next = settingsSchema.parse({ ...read().settings, ...patch });
      db.prepare("UPDATE haze SET settings = ? WHERE id = 1").run(JSON.stringify(next));
      return changed();
    },
    setImage: ({ dataUrl }) => {
      if (dataUrl === null) {
        db.prepare("UPDATE haze SET mime = NULL, version = NULL, bytes = NULL WHERE id = 1").run();
      } else {
        const { mime, bytes } = decode(dataUrl);
        db.prepare("UPDATE haze SET mime = ?, version = ?, bytes = ? WHERE id = 1")
          .run(mime, randomBytes(12).toString("hex"), bytes);
      }
      return changed();
    },
  });

  bb.http.route("GET", "/image", (c) => {
    const row = db.prepare("SELECT mime, version, bytes FROM haze WHERE id = 1").get() as
      Row & { bytes: Buffer | null };
    // The version in the URL makes each image immutable and cacheable.
    if (!row.bytes || !row.mime || c.req.query("v") !== row.version) return c.notFound();
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
