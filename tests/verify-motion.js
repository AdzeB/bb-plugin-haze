// Run in the isolated BB test instance. Use ?motion=on, then off, then reduce.
const p = await browser.getPage("main");
const url = new URL(p.url());
if (url.origin !== "http://127.0.0.1:38962") throw new Error("Use the isolated verification server.");
const mode = url.searchParams.get("motion") ?? "on";
const assert = (value, message) => { if (!value) throw new Error(message); };
async function click(kind, name) {
  const text = await p.snapshot({ interactive: true });
  const line = text.split("\n").find((line) => line.includes(`${kind} "${name}"`));
  const ref = line?.match(/\[ref=(e\d+)\]/)?.[1];
  assert(ref, `Missing ${name}`);
  await p.click(`ref/${ref}`);
}
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
await p.waitForSelector('[aria-label="Backdrop scene"]');
if (mode === "on") {
  await click("radio", "Honu Lagoon");
  if (!await p.$eval('[aria-label="Motion"]', (input) => input.checked)) await click("switch", "Motion");
  await p.evaluate(() => { document.querySelector("details").open = true; });
  const path = await saveFile("motion-example.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
    <style>@keyframes drift { to { transform:translateX(200px) } } .moon{animation:drift 1s infinite alternate linear}</style>
    <rect width="1600" height="1000" fill="#153352"/>
    <circle class="moon" cx="1000" cy="250" r="100" fill="#ffe9b0"/>
    <circle cx="100" cy="650" r="75" fill="#f99f76"><animate attributeName="cx" values="100;1500;100" dur="2s" repeatCount="indefinite"/></circle>
  </svg>`);
  const input = await p.$('details input[type="file"]');
  await input.uploadFile(path);
  await p.fill('[aria-label="Backdrop name"]', "Motion example");
  await click("button", "Preview backdrop");
  await p.waitForFunction(() => { const i = document.querySelector('img[alt="Custom backdrop preview"]'); return i?.complete && i.naturalWidth > 0; });
  await click("button", "Save backdrop");
  await p.waitForFunction(() => document.documentElement.dataset.hazeBackdrop?.startsWith("custom-"));
} else if (mode === "off") {
  if (await p.$eval('[aria-label="Motion"]', (input) => input.checked)) await click("switch", "Motion");
  await p.waitForFunction(() => !document.querySelector('[aria-label="Motion"]')?.checked);
} else {
  if (!await p.$eval('[aria-label="Motion"]', (input) => input.checked)) await click("switch", "Motion");
  await p.waitForFunction(() => document.querySelector('[aria-label="Motion"]')?.checked);
  await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
}
await p.goto(`${url.origin}/`);
await p.waitForFunction(() => { const i = document.querySelector(".haze-backdrop img"); return i?.complete && i.naturalWidth > 0; });
await p.evaluate(async () => { document.activeElement?.blur(); await document.fonts.ready; });
// Put the real mounted backdrop above BB only for capture, excluding carets and UI animation.
await p.$eval(".haze-backdrop", (layer) => { layer.style.zIndex = "2147483647"; });
await new Promise((resolve) => setTimeout(resolve, 400));
const source = await p.evaluate(async () => fetch(document.querySelector(".haze-backdrop img").src).then((r) => r.text()));
assert(mode === "on" ? source.includes("<animate ") : !source.includes("<animate ") && source.includes("animation: none !important"), "Incorrect motion source");
const first = await p.screenshot({ type: "jpeg", quality: 70 });
await new Promise((resolve) => setTimeout(resolve, 700));
const second = await p.screenshot({ type: "jpeg", quality: 70 });
await saveFile(`haze-motion-${mode}-1.jpg`, first);
await saveFile(`haze-motion-${mode}-2.jpg`, second);
const same = first.length === second.length && first.every((byte, i) => byte === second[i]);
const result = { name: `CSS and SVG animation: ${mode}`, status: (mode === "on" ? !same : same) ? "passed" : "failed", message: same ? "Frames match" : "Frames differ" };
console.log(await saveFile(`haze-motion-${mode}.json`, JSON.stringify([result], null, 2)));
console.log(result);
assert(result.status === "passed", "The rendered frames do not match the motion setting.");
