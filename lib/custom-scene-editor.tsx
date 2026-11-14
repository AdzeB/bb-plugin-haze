import { useEffect, useRef, useState } from "react";
import type { CustomScene } from "./model";
import { Button } from "../components/ui/button";
import { stillSvg } from "./backdrop";

const TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="sky" x2="0" y2="1">
      <stop stop-color="#13224a"/>
      <stop offset="1" stop-color="#245b6e"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes drift { to { transform: translateX(120px); } }
    .moon { animation: drift 12s ease-in-out infinite alternate; }
    @media (prefers-reduced-motion: reduce) { * { animation: none; } }
  </style>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <circle class="moon" cx="1100" cy="240" r="100" fill="#ffe9b0"/>
</svg>`;

type SceneInput = Pick<CustomScene, "name" | "scheme"> & { svg: string };

export function CustomSceneEditor({ motion, onSave }: { motion: boolean; onSave: (input: SceneInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<CustomScene["scheme"]>("dark");
  const [svg, setSvg] = useState("");
  const [preview, setPreview] = useState<{ source: string; url: string; stillUrl: string } | null>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => {
    if (preview) { URL.revokeObjectURL(preview.url); URL.revokeObjectURL(preview.stillUrl); }
  }, [preview]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function showPreview() {
    setBusy(true);
    setError(null);
    let url: string | null = null;
    try {
      if (new Blob([svg]).size > 1024 * 1024) throw new Error("Use an SVG smaller than 1 MiB.");
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg" || doc.doctype) {
        throw new Error("Paste a complete SVG document, starting with <svg> and ending with </svg>.");
      }
      doc.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const source = new XMLSerializer().serializeToString(doc);
      url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
      const image = new Image();
      image.src = url;
      await image.decode();
      const stillUrl = URL.createObjectURL(new Blob([stillSvg(source)], { type: "image/svg+xml" }));
      setPreview({ source: svg, url, stillUrl });
      url = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), scheme, svg });
      setName("");
      setSvg("");
      setPreview(null);
      if (details.current) details.current.open = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 1024 * 1024) { setError("Use an SVG smaller than 1 MiB."); return; }
    try {
      setSvg(await file.text());
      if (!name) setName(file.name.replace(/\.svg$/i, "").slice(0, 80));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  return <details ref={details} className="rounded-lg border border-border p-3">
    <summary className="cursor-pointer text-sm font-medium">Create your own backdrop</summary>
    <fieldset disabled={busy} className="mt-3 flex min-w-0 flex-col gap-3 border-0 p-0 disabled:opacity-60">
      <p className="text-xs text-muted-foreground">Paste an SVG or upload an .svg file (up to 1 MiB). CSS and SVG animations work. Keep images and fonts inside the file.</p>
      <label className="flex flex-col gap-1 text-sm">Backdrop name
        <input aria-label="Backdrop name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)}
          placeholder="My moonlit sky" className="h-8 rounded-md border border-border bg-background px-2 text-sm" />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">Appearance
        <select aria-label="Custom backdrop appearance" value={scheme} onChange={(e) => setScheme(e.target.value === "light" ? "light" : "dark")}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm">
          <option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>Upload SVG</Button>
        <Button size="sm" variant="ghost" onClick={() => { setSvg(TEMPLATE); if (!name) setName("Moonlit sky"); setScheme("dark"); }}>Start with a template</Button>
        <input ref={fileInput} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => {
          void choose(e.target.files?.[0]); e.target.value = "";
        }} />
      </div>
      <label className="flex min-w-0 flex-col gap-1 text-sm">SVG artwork
        <textarea aria-label="SVG artwork" value={svg} onChange={(e) => setSvg(e.target.value)} rows={8} spellCheck={false}
          placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">…</svg>'}
          className="w-full min-w-0 rounded-md border border-border bg-background p-2 font-mono text-xs" />
      </label>
      {preview && <img src={motion && !reduced ? preview.url : preview.stillUrl} alt="Custom backdrop preview" className="aspect-video w-full rounded-md border border-border object-cover" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!svg.trim()} onClick={() => void showPreview()}>Preview backdrop</Button>
        <Button size="sm" disabled={!name.trim() || preview?.source !== svg} onClick={() => void save()}>Save backdrop</Button>
      </div>
      {preview && preview.source !== svg && <p className="text-xs text-muted-foreground">Preview your changes before saving.</p>}
    </fieldset>
  </details>;
}
