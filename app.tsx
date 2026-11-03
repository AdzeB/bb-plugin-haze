// Haze frontend. All drawing is CSS (app.css); this file only puts the saved
// background on <html> and renders the settings page.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  definePluginApp,
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { HazeSettings, rpcContract, Snapshot } from "./server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./app.css";

const MAX_EDGE = 2560;

function useSnapshot() {
  const rpc = useRpc<typeof rpcContract>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(() => {
    rpc.call("get", null).then(setSnapshot, (cause) => setError(String(cause)));
  }, [rpc]);
  useEffect(refetch, [refetch]);
  useRealtime("changed", refetch);
  // Realtime signals are not replayed, so catch up after a reconnect.
  const connection = useRealtimeConnectionState();
  useEffect(() => {
    if (connection === "connected") refetch();
  }, [connection, refetch]);
  return { rpc, snapshot, setSnapshot, error, setError };
}

const VARS = ["--haze-image", "--haze-empty-opacity", "--haze-session-opacity"];

function paint(snapshot: Snapshot | null): void {
  const root = document.documentElement;
  if (!snapshot?.imageUrl) return unpaint();
  const { effect, emptyOpacity, sessionOpacity, scope } = snapshot.settings;
  root.dataset.haze = effect;
  root.style.setProperty("--haze-image", `url("${snapshot.imageUrl}")`);
  root.style.setProperty("--haze-empty-opacity", String(emptyOpacity));
  root.style.setProperty("--haze-session-opacity", String(scope === "empty" ? 0 : sessionOpacity));
}

function unpaint(): void {
  const root = document.documentElement;
  delete root.dataset.haze;
  for (const name of VARS) root.style.removeProperty(name);
}

/** Mounted once per window; keeps <html> in sync with the saved background. */
function HazeRoot() {
  const { snapshot } = useSnapshot();
  useEffect(() => paint(snapshot), [snapshot]);
  useEffect(() => unpaint, []);
  return null;
}

/** Downscale on the client so the stored image stays small. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.9);
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1 rounded-lg border border-border p-0.5">
        {options.map(([option, text]) => (
          <Button
            key={option}
            size="sm"
            variant="ghost"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Strength({
  label,
  value,
  disabled,
  onInput,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onInput: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-4 text-sm", disabled && "opacity-50")}>
      {label}
      <span className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          disabled={disabled}
          className="w-40 accent-foreground"
          onChange={(event) => onInput(Number(event.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        <output className="w-9 text-right tabular-nums text-muted-foreground">
          {Math.round(value * 100)}%
        </output>
      </span>
    </label>
  );
}

function Pane({ kind, title, children }: { kind: "empty" | "session"; title: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-1 flex-col gap-1.5">
      <div data-kind={kind} className="haze-pane relative aspect-[16/11] rounded-lg border border-border">
        {children}
      </div>
      <figcaption className="text-xs text-muted-foreground">{title}</figcaption>
    </figure>
  );
}

const bar = "h-1.5 rounded-full bg-muted-foreground/30";
const composer = "rounded-md border border-border bg-background h-7";

function HazeSettingsPage() {
  const { rpc, snapshot, setSnapshot, error, setError } = useSnapshot();
  const [draft, setDraft] = useState<HazeSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const settings = draft ?? snapshot?.settings ?? null;

  function run(call: Promise<Snapshot>) {
    setBusy(true);
    setError(null);
    call.then(
      (next) => {
        setSnapshot(next);
        setDraft(null);
      },
      (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
    ).finally(() => setBusy(false));
  }
  const save = (patch: Partial<HazeSettings>) => run(rpc.call("set", patch));
  // Sliders repaint this window while dragging and save on release.
  function input(key: "emptyOpacity" | "sessionOpacity", value: number) {
    if (!snapshot || !settings) return;
    const next = { ...settings, [key]: value };
    setDraft(next);
    paint({ ...snapshot, settings: next });
  }
  async function choose(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    try {
      run(rpc.call("setImage", { dataUrl: await toDataUrl(file) }));
    } catch {
      setError("That image could not be read.");
    }
  }

  if (!settings || !snapshot) {
    return <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>;
  }
  const hasImage = snapshot.imageUrl !== null;
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div
        className="flex gap-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void choose(event.dataTransfer.files[0]);
        }}
      >
        <Pane kind="empty" title="New thread">
          <div className="absolute inset-x-[14%] top-[44%]">
            <div className={cn(composer, "h-9")} />
          </div>
        </Pane>
        <Pane kind="session" title="Conversation">
          <div className="absolute inset-x-[14%] top-[18%] flex flex-col gap-2">
            <div className={cn(bar, "ml-auto w-2/5")} />
            <div className={cn(bar, "w-11/12")} />
            <div className={cn(bar, "w-4/5")} />
            <div className={cn(bar, "w-3/5")} />
          </div>
          <div className={cn(composer, "absolute inset-x-[14%] bottom-[8%]")} />
        </Pane>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          {hasImage ? "Replace image" : "Choose image"}
        </Button>
        {hasImage && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(rpc.call("setImage", { dataUrl: null }))}>
            Remove
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {busy ? "Saving…" : hasImage ? "Drop an image on the previews to replace it." : "Choose or drop an image to turn Haze on."}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <fieldset disabled={busy || !hasImage} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-60">
        <Segmented
          label="Effect"
          value={settings.effect}
          options={[["haze", "Haze"], ["plain", "Plain"]]}
          onChange={(effect) => save({ effect })}
        />
        <Segmented
          label="Show on"
          value={settings.scope}
          options={[["all", "Everywhere"], ["empty", "New thread only"]]}
          onChange={(scope) => save({ scope })}
        />
        <Strength
          label="New thread strength"
          value={settings.emptyOpacity}
          onInput={(value) => input("emptyOpacity", value)}
          onCommit={() => draft && save({ emptyOpacity: draft.emptyOpacity })}
        />
        <Strength
          label="Conversation strength"
          value={settings.sessionOpacity}
          disabled={settings.scope === "empty"}
          onInput={(value) => input("sessionOpacity", value)}
          onCommit={() => draft && save({ sessionOpacity: draft.sessionOpacity })}
        />
      </fieldset>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "haze-root", component: HazeRoot });
  app.slots.settingsSection({
    id: "background",
    title: "Background",
    description: "Your image as a soft haze at the top of New thread and every conversation, fading out before the text.",
    component: HazeSettingsPage,
  });
});
