import test from "node:test";
import assert from "node:assert/strict";
import { parseCustomSvg, MAX_SVG_BYTES } from "../lib/custom-svg.ts";

test("keeps self-contained artwork, CSS and SVG animation", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><circle id="dot" r="10"/></defs><style>@keyframes drift { to { opacity: .5 } } .dot {animation:drift 2s infinite}</style><use href="#dot" class="dot"><animate attributeName="x" values="0;10;0" dur="2s" repeatCount="indefinite"/></use></svg>`;
  const result = parseCustomSvg(svg);
  assert.match(result, /@keyframes drift/);
  assert.match(result, /<animate /);
  assert.match(result, /href="#dot"/);
});

test("adds the SVG namespace to plain pasted artwork", () => {
  assert.match(parseCustomSvg('<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'), /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
});

test("keeps embedded fonts", () => {
  const result = parseCustomSvg('<svg><style>@font-face{font-family:local;src:url(data:font/woff2;base64,AA==)}</style><text>hello</text></svg>');
  assert.match(result, /data:font\/woff2;base64,AA==/);
});

for (const [name, source] of [
  ["malformed XML", '<svg><circle></svg>'],
  ["HTML", '<html><body>Hello</body></html>'],
  ["document entities", '<!DOCTYPE svg [<!ENTITY a "b">]><svg/>'],
  ["scripts", '<svg><script>alert(1)</script></svg>'],
  ["HTML embedding", '<svg><foreignObject><div/></foreignObject></svg>'],
  ["event handlers", '<svg onload="alert(1)"/>'],
  ["external images", '<svg><image href="https://example.com/a.png"/></svg>'],
  ["external CSS", '<svg><style>@import "https://example.com/a.css";</style></svg>'],
  ["external paint", '<svg><rect fill="url(https://example.com/a.svg)"/></svg>'],
]) {
  test(`rejects ${name}`, () => assert.throws(() => parseCustomSvg(source)));
}

test("rejects oversized UTF-8 artwork", () => {
  assert.throws(() => parseCustomSvg(`<svg><text>${"é".repeat(MAX_SVG_BYTES / 2)}</text></svg>`), /1 MiB/);
});
