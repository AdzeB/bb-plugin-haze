// Haze frontend. Image backgrounds are drawn in CSS (app.css); this file puts
// the active background on <html>, runs the pixel effects and the live
// backdrop scenes (lib/backdrop.tsx), and renders the settings page.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  definePluginApp,
  useBbContext,
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import {
  activeBackground,
  BLUR,
  EFFECT_DESCRIPTIONS,
  EFFECT_LABELS,
  EFFECTS,
  OPACITY,
  SIDEBAR_OPACITY,
  VEIL,
  type Backdrop,
  type Background,
  type BackgroundSettings,
  type Effect,
  type Glass,
  type Snapshot,
} from "./lib/model";
import { disposeEffects, needsWorker, renderEffect } from "./lib/effects";
import { BackdropLayer, ImageBackdrop, SceneCanvas, useColorSchemeOverride } from "./lib/backdrop";
import { SCENE_LIST, sceneById, type SceneDefinition } from "./lib/scenes";
import type { Scheme } from "./lib/scenes/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./app.css";

const MAX_EDGE = 2560;
const GLOBAL = "global";

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

/** Follows BB's theme, which the pixel effects use to pick black or white paper. */
function useLightTheme(): boolean {
  const read = () => !document.documentElement.classList.contains("dark");
  const [light, setLight] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setLight(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return light;
}

/**
 * The image to draw for `effect`: the original, or the worker's version once
 * it is ready. Null until then, so the original never flashes first.
 */
function useEffectImage(url: string | null, effect: Effect): string | null {
  const light = useLightTheme();
  const worker = Boolean(url) && needsWorker(effect);
  const [rendered, setRendered] = useState<{ key: string; url: string } | null>(null);
  const key = `${url}|${effect}|${light}`;
  useEffect(() => {
    if (!url || !worker) return;
    let live = true;
    renderEffect(url, effect, light).then(
      (result) => live && setRendered({ key, url: result }),
      () => live && setRendered({ key, url }), // fall back to the original
    );
    return () => {
      live = false;
    };
  }, [url, effect, light, worker, key]);
  if (!url) return null;
  if (!worker) return url;
  return rendered?.key === key ? rendered.url : null;
}

/** The CSS variables and attribute one background needs, on <html> or a preview. */
function backgroundStyle(settings: BackgroundSettings, image: string) {
  return {
    mode: settings.effect === "gradient-blur" ? "haze" : "plain",
    vars: {
      "--haze-image": `url("${image}")`,
      "--haze-empty-opacity": String(settings.emptyOpacity),
      "--haze-session-opacity": String(settings.scope === "empty" ? 0 : settings.sessionOpacity),
      "--haze-veil": String(settings.veil),
    },
  };
}

const VARS = [
  "--haze-image",
  "--haze-empty-opacity",
  "--haze-session-opacity",
  "--haze-veil",
  "--haze-window-image",
  "--haze-sidebar-opacity",
  "--haze-glass-blur",
];

function paint(background: Background, image: string | null, glass: Glass | null): void {
  const root = document.documentElement;
  if (!background.imageUrl || !image) return unpaint();
  const { mode, vars } = backgroundStyle(background.settings, image);
  root.dataset.haze = mode;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  if (glass?.enabled) {
    root.dataset.hazeGlass = glass.body ? "body" : "sidebar";
    // The window shows the original artwork, like the desktop behind MonoCode.
    root.style.setProperty("--haze-window-image", `url("${background.imageUrl}")`);
    root.style.setProperty("--haze-sidebar-opacity", String(glass.sidebarOpacity));
    root.style.setProperty("--haze-glass-blur", `${glass.blur}px`);
  } else {
    delete root.dataset.hazeGlass;
  }
}

function unpaint(): void {
  const root = document.documentElement;
  delete root.dataset.haze;
  delete root.dataset.hazeGlass;
  for (const name of VARS) root.style.removeProperty(name);
}

const BACKDROP_VARS = ["--haze-backdrop-base", "--haze-veil", "--haze-sidebar-opacity", "--haze-glass-blur"];

/**
 * Something drawn behind the whole window: a scene (`id` is its id) or a
 * full-screen image (`id` is "image"). It replaces the top haze everywhere.
 */
function paintBackdrop(id: string, base: string, veil: number, glass: Glass): void {
  unpaint();
  const root = document.documentElement;
  root.dataset.hazeBackdrop = id;
  root.style.setProperty("--haze-backdrop-base", base);
  root.style.setProperty("--haze-veil", String(veil));
  root.style.setProperty("--haze-sidebar-opacity", String(glass.sidebarOpacity));
  root.style.setProperty("--haze-glass-blur", `${glass.blur}px`);
}

function unpaintBackdrop(): void {
  const root = document.documentElement;
  if (!root.dataset.hazeBackdrop) return;
  delete root.dataset.hazeBackdrop;
  for (const name of BACKDROP_VARS) root.style.removeProperty(name);
}

/** Palette commands ask the mounted HazeRoot to save, since only it holds an RPC client. */
const SET_BACKDROP = "haze:set-backdrop";
let shownScene: string = "none";
let shownScheme: Scheme = "light";

/** Mounted once per window; keeps <html> in sync with the backdrop or the focused project's background. */
function HazeRoot() {
  const { rpc, snapshot } = useSnapshot();
  const { projectId } = useBbContext();
  const background = snapshot ? activeBackground(snapshot, projectId) : null;
  const scene = sceneById(snapshot?.backdrop.scene);
  const image = useEffectImage(scene ? null : (background?.imageUrl ?? null), background?.settings.effect ?? "none");
  const fullImage = !scene && image && background?.settings.fill === "full" ? image : null;
  // Light or Dark draws that version and holds BB in it; Match BB follows BB's theme.
  const mode = snapshot?.backdrop.colorScheme ?? "auto";
  const bbLight = useLightTheme();
  const scheme: Scheme = mode === "auto" ? (bbLight ? "light" : "dark") : mode;
  useColorSchemeOverride(scene && mode !== "auto" ? mode : null);
  useEffect(() => {
    if (!snapshot || !background) return;
    shownScene = scene?.id ?? "none";
    shownScheme = scheme;
    if (scene) return paintBackdrop(scene.id, scene.base[scheme], snapshot.backdrop.veil, snapshot.glass);
    if (fullImage) return paintBackdrop("image", "var(--background)", background.settings.veil, snapshot.glass);
    unpaintBackdrop();
    paint(background, image, snapshot.glass);
  }, [snapshot, background, scene, scheme, image, fullImage]);
  // Reveal a scene the user picks, not the one already on when the window opens.
  const loaded = useRef(false);
  useEffect(() => {
    if (snapshot) loaded.current = true;
  }, [snapshot]);
  useEffect(() => {
    const onSet = (event: Event) => {
      rpc.call("setBackdrop", (event as CustomEvent<Partial<Backdrop>>).detail).catch(() => {});
    };
    window.addEventListener(SET_BACKDROP, onSet);
    return () => window.removeEventListener(SET_BACKDROP, onSet);
  }, [rpc]);
  useEffect(
    () => () => {
      unpaint();
      unpaintBackdrop();
      disposeEffects();
    },
    [],
  );
  if (!snapshot) return null;
  if (scene) {
    return <BackdropLayer scene={scene} scheme={scheme} animate={snapshot.backdrop.motion} reveal={loaded.current} />;
  }
  if (fullImage && background) {
    return <ImageBackdrop url={fullImage} haze={background.settings.effect === "gradient-blur"} />;
  }
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

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex flex-col text-sm">
        {label}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <Row label={label} hint={hint}>
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
    </Row>
  );
}

function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Slider({
  label,
  value,
  range,
  format,
  disabled,
  onInput,
  onCommit,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  format: (value: number) => string;
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
          min={range.min}
          max={range.max}
          step={range.max > 1 ? 1 : 0.01}
          value={value}
          disabled={disabled}
          className="w-40 accent-foreground"
          onChange={(event) => onInput(Number(event.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        <output className="w-10 text-right tabular-nums text-muted-foreground">{format(value)}</output>
      </span>
    </label>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-foreground"
      />
    </Row>
  );
}

const bar = "h-1.5 rounded-full bg-muted-foreground/30";
const composer = "rounded-md border border-border bg-background h-7";

function Previews({ settings, imageUrl }: { settings: BackgroundSettings; imageUrl: string | null }) {
  const image = useEffectImage(imageUrl, settings.effect);
  const style = image ? backgroundStyle(settings, image) : null;
  return (
    <div
      className="haze-preview flex gap-3"
      data-haze={style?.mode}
      data-fill={settings.fill}
      style={style?.vars as CSSProperties | undefined}
    >
      <figure className="m-0 flex flex-1 flex-col gap-1.5">
        <div data-kind="empty" className="haze-pane relative aspect-[16/11] rounded-lg border border-border">
          <div className="absolute inset-x-[14%] top-[44%]">
            <div className={cn(composer, "h-9")} />
          </div>
        </div>
        <figcaption className="text-xs text-muted-foreground">New thread</figcaption>
      </figure>
      <figure className="m-0 flex flex-1 flex-col gap-1.5">
        <div data-kind="session" className="haze-pane relative aspect-[16/11] rounded-lg border border-border">
          <div className="absolute inset-x-[14%] top-[18%] flex flex-col gap-2">
            <div className={cn(bar, "ml-auto w-2/5")} />
            <div className={cn(bar, "w-11/12")} />
            <div className={cn(bar, "w-4/5")} />
            <div className={cn(bar, "w-3/5")} />
          </div>
          <div className={cn(composer, "absolute inset-x-[14%] bottom-[8%]")} />
        </div>
        <figcaption className="text-xs text-muted-foreground">Conversation</figcaption>
      </figure>
    </div>
  );
}

type Rpc = ReturnType<typeof useSnapshot>["rpc"];

/** Image, effect, scope and visibility for the global background or one project's. */
function BackgroundEditor({
  target,
  background,
  fallback,
  busy,
  rpc,
  run,
  onError,
}: {
  target: string;
  background: Background | undefined;
  fallback: BackgroundSettings;
  busy: boolean;
  rpc: Rpc;
  run: (call: Promise<Snapshot>) => void;
  onError: (message: string) => void;
}) {
  const saved = background?.settings ?? fallback;
  const [draft, setDraft] = useState<BackgroundSettings | null>(null);
  const settings = draft ?? saved;
  const fileInput = useRef<HTMLInputElement>(null);
  const hasImage = Boolean(background?.imageUrl);
  const isGlobal = target === GLOBAL;
  useEffect(() => setDraft(null), [target, background]);

  const save = (patch: Partial<BackgroundSettings>) => run(rpc.call("set", { target, patch }));
  async function choose(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onError("Choose an image file.");
    try {
      run(rpc.call("setImage", { target, dataUrl: await toDataUrl(file) }));
    } catch {
      onError("That image could not be read.");
    }
  }
  const slide = (key: "emptyOpacity" | "sessionOpacity") => ({
    value: settings[key],
    range: OPACITY,
    format: percent,
    onInput: (value: number) => setDraft({ ...settings, [key]: value }),
    onCommit: () => draft && save({ [key]: draft[key] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void choose(event.dataTransfer.files[0]);
        }}
      >
        <Previews settings={settings} imageUrl={background?.imageUrl ?? null} />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          {hasImage ? "Replace image" : "Choose image"}
        </Button>
        {hasImage && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(rpc.call("setImage", { target, dataUrl: null }))}>
            {isGlobal ? "Remove" : "Remove project background"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {busy ? "Saving…" : hasImage ? "Drop an image on the previews to replace it." : isGlobal ? "Choose or drop an image to turn the background on." : "This project uses the global background."}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <fieldset disabled={busy || !hasImage} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-60">
        <Select
          label="Effect"
          hint={EFFECT_DESCRIPTIONS[settings.effect]}
          value={settings.effect}
          options={EFFECTS.map((effect) => [effect, EFFECT_LABELS[effect]])}
          onChange={(effect) => save({ effect })}
        />
        <Segmented
          label="Fill"
          hint={
            settings.fill === "full"
              ? "The image fills the whole window, under the header and the composer."
              : "A haze at the top that fades out before the text."
          }
          value={settings.fill}
          options={[["top", "Top haze"], ["full", "Full screen"]]}
          onChange={(fill) => save({ fill })}
        />
        {settings.fill === "full" ? (
          <Slider
            label="Reading veil"
            value={settings.veil}
            range={VEIL}
            format={percent}
            onInput={(veil) => setDraft({ ...settings, veil })}
            onCommit={() => draft && save({ veil: draft.veil })}
          />
        ) : (
          <>
            <Segmented
              label="Show on"
              value={settings.scope}
              options={[["all", "All sessions"], ["empty", "Empty chats"]]}
              onChange={(scope) => save({ scope })}
            />
            <Slider label="Empty chat visibility" {...slide("emptyOpacity")} />
            <Slider label="Session visibility" disabled={settings.scope === "empty"} {...slide("sessionOpacity")} />
          </>
        )}
      </fieldset>
    </div>
  );
}

function GlassEditor({ glass, busy, rpc, run }: { glass: Glass; busy: boolean; rpc: Rpc; run: (call: Promise<Snapshot>) => void }) {
  const [draft, setDraft] = useState<Glass | null>(null);
  const value = draft ?? glass;
  useEffect(() => setDraft(null), [glass]);
  const save = (patch: Partial<Glass>) => run(rpc.call("setGlass", patch));
  return (
    <fieldset disabled={busy} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-60">
      <Toggle
        label="Window glass"
        hint="Draws the background across the whole window, behind the sidebar and every pane."
        checked={value.enabled}
        onChange={(enabled) => save({ enabled })}
      />
      <fieldset disabled={!value.enabled} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-50">
        <Slider
          label="Sidebar opacity"
          value={value.sidebarOpacity}
          range={SIDEBAR_OPACITY}
          format={percent}
          onInput={(sidebarOpacity) => setDraft({ ...value, sidebarOpacity })}
          onCommit={() => draft && save({ sidebarOpacity: draft.sidebarOpacity })}
        />
        <Slider
          label="Blur radius"
          value={value.blur}
          range={BLUR}
          format={(px) => `${px}px`}
          onInput={(blur) => setDraft({ ...value, blur })}
          onCommit={() => draft && save({ blur: draft.blur })}
        />
        <Toggle
          label="Main pane glass"
          hint="Lets the window show through the conversation area too."
          checked={value.body}
          onChange={(body) => save({ body })}
        />
      </fieldset>
    </fieldset>
  );
}

function SceneCard({
  scene,
  scheme,
  selected,
  onSelect,
}: {
  scene: SceneDefinition | null;
  scheme: Scheme;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={scene?.description[scheme] ?? "No backdrop: Haze shows your chat background image."}
      onClick={onSelect}
      className={cn(
        "flex w-36 flex-col gap-1.5 rounded-lg border-0 bg-transparent p-1 text-left text-xs outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
        selected ? "ring-2 ring-primary" : "hover:bg-muted",
      )}
    >
      <span
        className="relative block aspect-[16/10] w-full overflow-hidden rounded-md border border-border"
        style={{ background: scene?.base[scheme] ?? "var(--background)" }}
      >
        {scene ? (
          <SceneCanvas scene={scene} scheme={scheme} animate scale={0.3} className="absolute inset-0 size-full" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted-foreground">Off</span>
        )}
      </span>
      <span className="px-0.5">
        {scene?.label ?? "None"}
        {selected && <span aria-hidden="true"> ✓</span>}
      </span>
    </button>
  );
}

function BackdropEditor({ backdrop, busy, rpc, run }: { backdrop: Backdrop; busy: boolean; rpc: Rpc; run: (call: Promise<Snapshot>) => void }) {
  const [veil, setVeil] = useState<number | null>(null);
  useEffect(() => setVeil(null), [backdrop]);
  const save = (patch: Partial<Backdrop>) => run(rpc.call("setBackdrop", patch));
  const scene = sceneById(backdrop.scene);
  const bbLight = useLightTheme();
  const scheme: Scheme = backdrop.colorScheme === "auto" ? (bbLight ? "light" : "dark") : backdrop.colorScheme;
  return (
    <fieldset disabled={busy} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-60">
      <div role="radiogroup" aria-label="Backdrop scene" className="flex flex-wrap gap-2">
        <SceneCard scene={null} scheme={scheme} selected={!scene} onSelect={() => save({ scene: "none" })} />
        {SCENE_LIST.map((option) => (
          <SceneCard
            key={option.id}
            scheme={scheme}
            scene={option}
            selected={scene?.id === option.id}
            onSelect={() => save({ scene: option.id })}
          />
        ))}
      </div>
      <fieldset disabled={!scene} className="flex flex-col gap-3 border-0 p-0 disabled:opacity-50">
        <Segmented
          label="Mode"
          hint={
            backdrop.colorScheme === "auto"
              ? "Follows BB's theme: the day version in light mode, the night version in dark."
              : `Draws the ${backdrop.colorScheme === "light" ? "day" : "night"} version and switches BB to ${backdrop.colorScheme} mode while it shows.`
          }
          value={backdrop.colorScheme}
          options={[["light", "Light"], ["dark", "Dark"], ["auto", "Match BB"]]}
          onChange={(colorScheme) => save({ colorScheme })}
        />
        <Slider
          label="Reading veil"
          value={veil ?? backdrop.veil}
          range={VEIL}
          format={percent}
          onInput={setVeil}
          onCommit={() => veil !== null && save({ veil })}
        />
        <Toggle
          label="Motion"
          hint="Off holds one still frame. The system's reduced-motion setting also stills it."
          checked={backdrop.motion}
          onChange={(motion) => save({ motion })}
        />
      </fieldset>
    </fieldset>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function HazeSettingsPage() {
  const { rpc, snapshot, setSnapshot, error, setError } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const context = useBbContext();
  useEffect(() => {
    rpc.call("projects", null).then((list) => {
      setProjects(list);
      setProjectId((current) => current || (context.projectId && list.some((p) => p.id === context.projectId) ? context.projectId : list[0]?.id ?? ""));
    }, () => {});
  }, [rpc, context.projectId]);

  function run(call: Promise<Snapshot>) {
    setBusy(true);
    setError(null);
    call
      .then(setSnapshot, (cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false));
  }

  if (!snapshot) return <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>;
  const editor = { busy, rpc, run, onError: setError };
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Section
        title="Backdrop"
        description="A live scene behind the whole window, from the top of the conversation to under the composer. While one is on it replaces the chat background."
      >
        <BackdropEditor backdrop={snapshot.backdrop} busy={busy} rpc={rpc} run={run} />
      </Section>

      <Section title="Chat background" description="Your image behind New thread and every conversation: a haze at the top that fades before the text, or full screen.">
        <BackgroundEditor target={GLOBAL} background={snapshot.global} fallback={snapshot.global.settings} {...editor} />
      </Section>

      <Section title="Window" description="MonoCode's translucent window, with your background in place of the desktop.">
        <GlassEditor glass={snapshot.glass} busy={busy} rpc={rpc} run={run} />
      </Section>

      {projects.length > 0 && (
        <Section title="Project backgrounds" description="Give a project its own image and settings. Projects without one use the chat background.">
          <Select
            label="Project"
            value={projectId}
            options={projects.map((p) => [p.id, snapshot.projects[p.id]?.imageUrl ? `${p.name} (custom)` : p.name])}
            onChange={setProjectId}
          />
          {projectId && (
            <BackgroundEditor
              key={projectId}
              target={projectId}
              background={snapshot.projects[projectId]}
              fallback={snapshot.global.settings}
              {...editor}
            />
          )}
        </Section>
      )}

      <div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(rpc.call("reset", null))}>
          Reset to defaults
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">Clears the backdrop, the chat background image and window settings. Project backgrounds stay.</p>
      </div>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "haze-root", component: HazeRoot });
  const setBackdrop = (detail: Partial<Backdrop>) => {
    window.dispatchEvent(new CustomEvent(SET_BACKDROP, { detail }));
  };
  for (const scene of SCENE_LIST) {
    app.commands.register({
      id: `backdrop-${scene.id}`,
      title: `Haze: ${scene.label} backdrop`,
      isAvailable: () => shownScene !== scene.id,
      run: () => setBackdrop({ scene: scene.id }),
    });
  }
  app.commands.register({
    id: "backdrop-day-night",
    title: "Haze: Switch the backdrop between day and night",
    isAvailable: () => shownScene !== "none",
    run: () => setBackdrop({ colorScheme: shownScheme === "light" ? "dark" : "light" }),
  });
  app.commands.register({
    id: "backdrop-off",
    title: "Haze: Turn the backdrop off",
    isAvailable: () => shownScene !== "none",
    run: () => setBackdrop({ scene: "none" }),
  });
  app.slots.settingsSection({
    id: "background",
    title: "Background",
    description: "Live backdrops, a MonoCode-style chat background and a translucent window.",
    component: HazeSettingsPage,
  });
});
