/** Mirror BB's slide target and timing, not its per-frame rendered position.
 * Both clip-path and translate then animate natively on the same timeline.
 */
export function installMobileSidebarClip(): () => void {
  const revealKey = "--haze-mobile-sidebar-reveal";
  const timingKey = "--haze-mobile-sidebar-transition";
  const mobile = window.matchMedia("(max-width: 767px)");
  let panel: HTMLElement | null = null;
  let inset: HTMLElement | null = null;
  let initialized = false;
  let saved: [string, string][] = [];
  let heldShelf: string | null = null;
  let heldTarget = 0;

  const restore = () => {
    if (!panel) return;
    for (const [i, key] of [revealKey, timingKey].entries()) {
      const [value, priority] = saved[i] ?? ["", ""];
      if (value) panel.style.setProperty(key, value, priority);
      else panel.style.removeProperty(key);
    }
    initialized = false;
    heldShelf = null;
  };

  const update = () => {
    if (!panel || !inset) return;
    if (!mobile.matches || document.documentElement.dataset.hazeGlass !== "body") {
      if (initialized) restore();
      return;
    }
    const width = panel.getBoundingClientRect().width;
    // BB writes an inline translate during touch drags and settling. Otherwise
    // its data attributes select the CSS target. No dependence on sidebar
    // open/closed, which BB can update only after its animation has finished.
    const inline = Number.parseFloat(inset.style.translate);
    const shelf = `${inset.dataset.sidebarShelf}/${inset.dataset.panelShelf}`;
    let target: number;
    if (Number.isFinite(inline)) {
      target = inline;
      heldTarget = target;
      heldShelf = shelf;
    } else if (heldShelf === shelf) {
      // BB clears inline gesture styles before committing its final React
      // shelf state. Keep the settled target through that transient gap,
      // rather than briefly animating back toward the previous shelf state.
      target = heldTarget;
    } else {
      heldShelf = null;
      target = inset.dataset.panelShelf === "full" ? -inset.clientWidth
        : inset.dataset.sidebarShelf === "open" ? width : 0;
    }
    const style = getComputedStyle(inset);
    const properties = style.transitionProperty.split(",").map((s) => s.trim());
    const index = properties.findIndex((s) => s === "translate" || s === "all");
    const part = (value: string) => {
      const values = value.split(/,(?![^()]*\))/).map((s) => s.trim());
      return values[index % values.length];
    };
    const timing = initialized && index >= 0
      ? `clip-path ${part(style.transitionDuration)} ${part(style.transitionTimingFunction)} ${part(style.transitionDelay)}`
      : "none";
    panel.style.setProperty(timingKey, timing);
    panel.style.setProperty(revealKey, `${Math.max(0, Math.min(width, target))}px`);
    initialized = true;
  };

  const geometry = new ResizeObserver(update);
  const attributes = new MutationObserver(update);
  const bind = () => {
    const nextPanel = document.querySelector<HTMLElement>('[data-sidebar="panel"]');
    const nextInset = document.querySelector<HTMLElement>('main[data-sidebar="inset"]');
    if (panel === nextPanel && inset === nextInset) return;
    restore();
    geometry.disconnect();
    attributes.disconnect();
    panel = nextPanel;
    inset = nextInset;
    saved = [revealKey, timingKey].map((key) => [
      panel?.style.getPropertyValue(key) ?? "", panel?.style.getPropertyPriority(key) ?? "",
    ]);
    // Don't observe the panel style we write ourselves.
    if (inset) {
      attributes.observe(inset, { attributes: true });
      geometry.observe(inset);
    }
    if (panel) geometry.observe(panel);
    update();
  };
  const structure = new MutationObserver(() => {
    if (!panel?.isConnected || !inset?.isConnected) bind();
  });
  structure.observe(document.body, { childList: true, subtree: true });
  const appearance = new MutationObserver(update);
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ["data-haze-glass"] });
  mobile.addEventListener("change", update);
  bind();
  return () => {
    geometry.disconnect();
    attributes.disconnect();
    structure.disconnect();
    appearance.disconnect();
    mobile.removeEventListener("change", update);
    restore();
  };
}
