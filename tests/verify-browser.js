// Run through bb browser-automation against an isolated BB on port 38962.
// Install this checkout there, finish onboarding, and open /settings/plugins/haze in "main".
const page = await browser.getPage("main");
if (new URL(page.url()).origin !== "http://127.0.0.1:38962") throw new Error("Use the isolated verification server on port 38962.");
const phase = new URL(page.url()).searchParams.get("verify") ?? "1";
const results = [];
const faults = [];
const onError = (error) => faults.push(error.message);
page.on("pageerror", onError);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function check(name, run) {
  try { await run(); results.push({ name, status: "passed" }); }
  catch (error) { results.push({ name, status: "failed", message: String(error) }); }
  await saveFile(`haze-browser-${phase}.json`, JSON.stringify(results, null, 2));
}
async function clickName(kind, name) {
  const snapshot = await page.snapshot({ interactive: true });
  const line = snapshot.split("\n").find((line) => line.includes(`${kind} "${name}"`));
  const ref = line?.match(/\[ref=(e\d+)\]/)?.[1];
  assert(ref, `Missing ${kind}: ${name}`);
  await page.click(`ref/${ref}`);
}
async function settled(id, canvas = false) {
  await page.waitForFunction((id) => document.documentElement.dataset.hazeBackdrop === id, {}, id);
  await page.waitForFunction((canvas) => {
    const layer = document.querySelector(".haze-backdrop");
    if (!layer || layer.children.length !== 1) return false;
    const image = layer.querySelector("img");
    return canvas ? Boolean(layer.querySelector("canvas")) : Boolean(image?.complete && image.naturalWidth > 0);
  }, {}, canvas);
}

try {
  await page.reload();
  await page.waitForSelector('[role="radiogroup"][aria-label="Backdrop scene"]');
  await check("Gallery includes all 21 built-in scenes", async () => {
    assert(await page.$$eval('[aria-label="Backdrop scene"] [role="radio"]', (items) => items.length) === 22, "Expected 21 scenes plus None");
  });
  await clickName("button", "Everywhere");
  const scenes = [
    ["Cloud Drift", "cloud-drift", null], ["Honu Lagoon", "honu-lagoon", "light"],
    ["Koi Mosaic", "koi-mosaic", "light"], ["Halftone Dawn", "halftone-dawn", "light"],
    ["Halftone Dusk", "halftone-dusk", "dark"], ["Plotter Tide", "plotter-tide", "light"],
    ["Plotter Tide, Night", "plotter-tide-night", "dark"], ["Dither Dunes", "dither-dunes", "light"],
    ["Dither Dunes Night", "dither-dunes-night", "dark"], ["Paper Garden", "paper-garden", "light"],
    ["Paper Garden, Kraft", "paper-garden-kraft", "dark"], ["Night Reef", "night-reef", "dark"],
    ["Snow Pines", "snow-pines", "dark"], ["Braille Stars", "braille-stars", "dark"],
    ["Block Clouds", "teletext-clouds", "dark"], ["Vector Range", "vector-range", "dark"],
    ["Departure Board", "departure-board", "dark"], ["Blueprint", "blueprint", "dark"],
    ["Deep Water", "deep-water", "dark"], ["Aurora", "aurora", "dark"], ["Ember", "ember", "dark"],
  ];
  const subset = phase === "controls" ? [] : scenes.slice((Number(phase) - 1) * 7, Number(phase) * 7);
  for (const [name, id, scheme] of subset) {
    await check(`${name} renders and selects its appearance`, async () => {
      await clickName("radio", name);
      await settled(id, id === "cloud-drift");
      if (scheme) assert(await page.evaluate(() => document.documentElement.classList.contains("dark")) === (scheme === "dark"), "Wrong appearance");
    });
  }
  if (phase === "controls") {
  await check("Light and Dark choose paired artwork", async () => {
    await clickName("radio", "Halftone Dawn");
    await settled("halftone-dawn");
    await clickName("button", "Dark");
    await settled("halftone-dusk");
    await clickName("button", "Light");
    await settled("halftone-dawn");
  });
  await check("Changing Show on preserves the selected scene", async () => {
    await clickName("button", "Conversations");
    await page.waitForFunction(() => document.documentElement.dataset.hazeReach === "conversations");
    assert(await page.evaluate(() => document.documentElement.dataset.hazeBackdrop) === "halftone-dawn", "A partial edit reset the scene");
    assert(await page.$eval(".haze-backdrop", (layer) => getComputedStyle(layer).display) === "none", "Settings should hide conversation-only backdrop");
    await clickName("button", "Everywhere");
    await settled("halftone-dawn");
  });
  await check("Match BB follows light and dark artwork", async () => {
    await clickName("button", "Match BB");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await settled("halftone-dusk");
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await settled("halftone-dawn");
  });
  await check("Create, preview and save a custom animated SVG", async () => {
    await page.click("summary");
    await clickName("button", "Start with a template");
    await page.fill('[aria-label="Backdrop name"]', "Verification sky");
    await clickName("button", "Preview backdrop");
    await page.waitForFunction(() => { const i = document.querySelector('img[alt="Custom backdrop preview"]'); return i?.complete && i.naturalWidth > 0; });
    await clickName("button", "Save backdrop");
    await page.waitForFunction(() => document.documentElement.dataset.hazeBackdrop?.startsWith("custom-"));
    const id = await page.evaluate(() => document.documentElement.dataset.hazeBackdrop);
    await settled(id);
    assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Custom appearance was not applied");
  });
  await check("Custom backdrop survives a page reload", async () => {
    const id = await page.evaluate(() => document.documentElement.dataset.hazeBackdrop);
    await page.reload();
    await settled(id);
    const selected = await page.$eval('[aria-label="Backdrop scene"] [aria-checked="true"]', (item) => item.textContent);
    assert(selected.includes("Verification sky"), "Custom scene missing after reload");
  });
  await check("Motion off preserves the custom selection and removes all animation", async () => {
    const id = await page.evaluate(() => document.documentElement.dataset.hazeBackdrop);
    await clickName("switch", "Motion");
    await page.waitForFunction(() => !document.querySelector('[role="switch"][aria-label="Motion"]')?.checked);
    await settled(id);
    await page.waitForFunction(async () => {
      const image = document.querySelector(".haze-backdrop img");
      return image?.src && (await fetch(image.src).then((r) => r.text())).includes("animation: none !important");
    });
  });
  await check("Custom SVG downloads as a sandboxed image", async () => {
    const download = await page.evaluate(async () => {
      const a = [...document.querySelectorAll("a")].find((a) => a.textContent === "Download SVG");
      const response = await fetch(a.href);
      return { status: response.status, csp: response.headers.get("content-security-policy"), source: await response.text() };
    });
    assert(download.status === 200 && download.source.includes("@keyframes drift") && download.csp.includes("sandbox"), "Download failed");
  });
  await check("Removing the selected custom backdrop clears it", async () => {
    await clickName("button", "Remove custom backdrop");
    await page.waitForFunction(() => !document.documentElement.dataset.hazeBackdrop);
    assert(await page.$$eval('[aria-label="Backdrop scene"] [role="radio"]', (items) => items.length) === 22, "Custom card was not removed");
  });
  await check("Malformed artwork shows an error before saving", async () => {
    await page.click("summary");
    await page.fill('[aria-label="SVG artwork"]', "<svg><broken>");
    await clickName("button", "Preview backdrop");
    await page.waitForSelector('[role="alert"]');
    assert((await page.$eval('[role="alert"]', (a) => a.textContent)).includes("complete SVG"), "Missing helpful error");
  });
  await check("Turning scenes off cleans up their layers", async () => {
    await clickName("radio", "Honu Lagoon");
    await settled("honu-lagoon");
    await clickName("radio", "Off None");
    await page.waitForFunction(() => !document.querySelector(".haze-backdrop") && !document.documentElement.dataset.hazeBackdrop);
  });
  }
  await check("No browser JavaScript errors", async () => assert(faults.length === 0, faults.join("\n")));
} finally {
  page.off("pageerror", onError);
  console.log(await saveFile(`haze-browser-${phase}.json`, JSON.stringify(results, null, 2)));
  console.log(JSON.stringify({ passed: results.filter((r) => r.status === "passed").length, failed: results.filter((r) => r.status === "failed") }));
}
if (results.some((r) => r.status === "failed")) throw new Error("Browser verification failed; see the report.");
