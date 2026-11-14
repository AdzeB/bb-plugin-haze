import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export const MAX_SVG_BYTES = 1024 * 1024;
const SVG_NS = "http://www.w3.org/2000/svg";
const ACTIVE_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed", "link"]);

/** Parse uploads once, before storage. Custom backdrops are self-contained images. */
export function parseCustomSvg(source: string): string {
  if (Buffer.byteLength(source, "utf8") > MAX_SVG_BYTES) throw new Error("Use an SVG smaller than 1 MiB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("SVGs cannot contain document types or entities.");
  const doc = new DOMParser({
    onError: () => { throw new Error("The SVG is not valid XML. Check its closing tags and attributes."); },
  }).parseFromString(source, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || (root.namespaceURI && root.namespaceURI !== SVG_NS)) {
    throw new Error("Use an SVG document with an <svg> root element.");
  }
  root.setAttribute("xmlns", SVG_NS);
  const elements = [root, ...Array.from(root.getElementsByTagName("*"))];
  const checkCss = (css: string) => {
    if (/@import/i.test(css)) throw new Error("Embed styles in the SVG instead of importing them.");
    for (const match of css.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) {
      if (!match[1]!.startsWith("#") && !/^data:(?:font\/(?:woff2?|ttf|otf)|application\/(?:font-woff|x-font-ttf));base64,/i.test(match[1]!)) {
        throw new Error("SVG styles can reference local shapes or embedded fonts only.");
      }
    }
  };
  for (const element of elements) {
    if (ACTIVE_ELEMENTS.has((element.localName ?? element.tagName).toLowerCase())) {
      throw new Error("Use SVG artwork without scripts, embedded HTML or external documents.");
    }
    if (element.localName === "style") checkCss(element.textContent ?? "");
    for (const attr of Array.from(element.attributes)) {
      if (/^on/i.test(attr.localName ?? attr.name)) throw new Error("Use CSS or SVG animations instead of event handlers.");
      if (attr.localName === "href" && !attr.value.startsWith("#")) {
        const inlineImage = element.localName === "image" && /^data:image\/(png|jpeg|webp);base64,/i.test(attr.value);
        if (!inlineImage) throw new Error("Embed images and fonts; links to external files are not supported.");
      }
      checkCss(attr.value);
    }
  }
  const result = new XMLSerializer().serializeToString(root);
  if (Buffer.byteLength(result, "utf8") > MAX_SVG_BYTES) throw new Error("Use an SVG smaller than 1 MiB.");
  return result;
}
