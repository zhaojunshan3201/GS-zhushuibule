import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type PptxTextElement = { id: string; type: "text"; text: string };
export type PptxImageElement = { id: string; type: "image"; relationshipId: string; target?: string };
export type PptxTableElement = { id: string; type: "table"; rows: string[][] };
export type PptxUnsupportedElement = { id: string; type: "unsupported"; xml: string };
export type PptxElement = PptxTextElement | PptxImageElement | PptxTableElement | PptxUnsupportedElement;

export type PptxSlide = {
  id: string;
  path: string;
  elements: PptxElement[];
  xml: string;
};

export type PptxWellHistoryDocument = {
  slides: PptxSlide[];
  dirty: boolean;
  source: Uint8Array;
};

export type PptxEdit =
  | { type: "replace-text"; slideId: string; elementId: string; text: string }
  | { type: "replace-table"; slideId: string; elementId: string; rows: string[][] }
  | { type: "delete-slide"; slideId: string }
  | { type: "add-slide"; afterSlideId: string }
  | { type: "reorder-slides"; fromIndex: number; toIndex: number };

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "@_" });
const textPattern = /(<a:t(?:\s[^>]*)?>)([\s\S]*?)<\/a:t>/g;
const tagText = (xml: string) => [...xml.matchAll(textPattern)].map((match) => decodeXml(match[2])).join("");
const idFor = (xml: string, fallback: string) => /<p:cNvPr\b[^>]*\bid="([^"]+)"/.exec(xml)?.[1] ?? fallback;
const decodeXml = (value: string) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const encodeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function slideId(path: string) {
  return path.split("/").pop()!.replace(/\.xml$/, "");
}

function relTargets(xml: string) {
  return new Map([...xml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*>/g)].map((match) => [match[1], match[2]]));
}

function parseRows(xml: string) {
  return [...xml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map((row) =>
    [...row[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((cell) => tagText(cell[0])),
  );
}

function parseElements(xml: string, targets: Map<string, string>) {
  const orderedNodes = parser.parse(xml);
  if (!Array.isArray(orderedNodes)) return [];
  const matches = [...xml.matchAll(/<p:(sp|pic|graphicFrame|extLst)\b[\s\S]*?<\/p:\1>/g)];
  return matches.map((match, index): PptxElement => {
    const raw = match[0];
    const id = `${match[1]}:${idFor(raw, String(index + 1))}`;
    if (match[1] === "sp" && /<p:txBody\b/.test(raw)) return { id, type: "text", text: tagText(raw) };
    if (match[1] === "pic") {
      const relationshipId = /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(raw)?.[1];
      if (relationshipId) return { id, type: "image", relationshipId, target: targets.get(relationshipId) };
    }
    if (match[1] === "graphicFrame" && /<a:tbl\b/.test(raw)) return { id, type: "table", rows: parseRows(raw) };
    return { id, type: "unsupported", xml: raw };
  });
}

function replaceTextInElement(raw: string, value: string) {
  let first = true;
  return raw.replace(textPattern, (_match, openingTag: string) => {
    const next = first ? encodeXml(value) : "";
    first = false;
    return `${openingTag}${next}</a:t>`;
  });
}

function replaceTableInElement(raw: string, rows: string[][]) {
  let cursor = 0;
  return raw.replace(textPattern, (_match, openingTag: string) => `${openingTag}${encodeXml(rows.flat()[cursor++] ?? "")}</a:t>`);
}

function replaceElement(xml: string, element: PptxElement) {
  const [kind, shapeId] = element.id.split(":");
  const pattern = new RegExp(`<p:${kind}\\b[\\s\\S]*?<\\/p:${kind}>`, "g");
  return xml.replace(pattern, (raw) => {
    if (idFor(raw, "") !== shapeId) return raw;
    if (element.type === "text") return replaceTextInElement(raw, element.text);
    if (element.type === "table") return replaceTableInElement(raw, element.rows);
    return raw;
  });
}

export async function parsePptxWellHistory(input: Uint8Array | ArrayBuffer) : Promise<PptxWellHistoryDocument> {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const zip = await JSZip.loadAsync(source);
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  const relationships = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!presentation || !relationships) throw new Error("Invalid PPTX: presentation files are missing");
  const targets = relTargets(relationships);
  const orderedRelIds = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?/g)].map((match) => match[1]);
  const slides: PptxSlide[] = [];
  for (const relationshipId of orderedRelIds) {
    const target = targets.get(relationshipId);
    if (!target) continue;
    const path = `ppt/${target.replace(/^\.\//, "")}`;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const relPath = path.replace(/([^/]+)$/, "_rels/$1.rels");
    const slideRelationships = await zip.file(relPath)?.async("string") ?? "";
    slides.push({ id: slideId(path), path, xml, elements: parseElements(xml, relTargets(slideRelationships)) });
  }
  return { slides, dirty: false, source: new Uint8Array(source) };
}

export function applyPptxEdit(document: PptxWellHistoryDocument, edit: PptxEdit): PptxWellHistoryDocument {
  if (edit.type === "reorder-slides") {
    if (!Number.isInteger(edit.fromIndex) || !Number.isInteger(edit.toIndex) || edit.fromIndex < 0 || edit.toIndex < 0 || edit.fromIndex >= document.slides.length || edit.toIndex >= document.slides.length || edit.fromIndex === edit.toIndex) return document;
    const slides = [...document.slides];
    const [slide] = slides.splice(edit.fromIndex, 1);
    slides.splice(edit.toIndex, 0, slide);
    return { ...document, dirty: true, slides };
  }
  if (edit.type === "add-slide") {
    const index = document.slides.findIndex((slide) => slide.id === edit.afterSlideId);
    if (index < 0) return document;
    const usedIds = new Set(document.slides.map((slide) => slide.id));
    const usedPaths = new Set(document.slides.map((slide) => slide.path));
    let number = document.slides.length + 1;
    while (usedIds.has(`slide${number}`) || usedPaths.has(`ppt/slides/slide${number}.xml`)) number += 1;
    const slide: PptxSlide = {
      id: `slide${number}`,
      path: `ppt/slides/slide${number}.xml`,
      elements: [],
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld></p:sld>',
    };
    const slides = [...document.slides];
    slides.splice(index + 1, 0, slide);
    return { ...document, dirty: true, slides };
  }
  if (edit.type === "delete-slide") {
    if (document.slides.length <= 1 || !document.slides.some((slide) => slide.id === edit.slideId)) return document;
    return { ...document, dirty: true, slides: document.slides.filter((slide) => slide.id !== edit.slideId) };
  }
  let changed = false;
  const slides = document.slides.map((slide) => {
    if (slide.id !== edit.slideId) return slide;
    let slideChanged = false;
    const elements = slide.elements.map((element) => {
      if (element.id !== edit.elementId || (edit.type === "replace-text" && element.type !== "text") || (edit.type === "replace-table" && element.type !== "table")) return element;
      changed = true;
      slideChanged = true;
      return edit.type === "replace-text" ? { ...element, text: edit.text } : { ...element, rows: edit.rows };
    });
    return slideChanged ? { ...slide, elements } : slide;
  });
  return changed ? { ...document, dirty: true, slides } : document;
}

export async function writePptxWellHistory(document: PptxWellHistoryDocument): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(document.source);
  const presentationPath = "ppt/presentation.xml";
  const presentationRelationshipsPath = "ppt/_rels/presentation.xml.rels";
  const presentation = await zip.file(presentationPath)?.async("string");
  const relationships = await zip.file(presentationRelationshipsPath)?.async("string");
  if (!presentation || !relationships) throw new Error("Invalid PPTX: presentation files are missing");

  const targets = relTargets(relationships);
  const presentationSlideRelationshipIds = new Set([...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?/g)].map((match) => match[1]));
  const relationshipIdForPath = new Map([...targets].map(([relationshipId, target]) => [`ppt/${target.replace(/^\.\//, "")}`, relationshipId]));
  const addedRelationships: Array<[string, string]> = [];
  let nextRelationshipNumber = Math.max(0, ...[...targets.keys()].map((id) => Number(/\d+$/.exec(id)?.[0]) || 0)) + 1;
  for (const slide of document.slides) {
    if (relationshipIdForPath.has(slide.path)) continue;
    const relationshipId = `rId${nextRelationshipNumber++}`;
    const target = slide.path.replace(/^ppt\//, "");
    relationshipIdForPath.set(slide.path, relationshipId);
    addedRelationships.push([relationshipId, target]);
  }
  const keptPaths = new Set(document.slides.map((slide) => slide.path));
  const removedRelationshipIds = new Set(
    [...targets]
      .filter(([relationshipId, target]) => presentationSlideRelationshipIds.has(relationshipId) && !keptPaths.has(`ppt/${target.replace(/^\.\//, "")}`))
      .map(([relationshipId]) => relationshipId),
  );
  const existingSlideEntries = new Map([...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?>(?:<\/p:sldId>)?/g)].map((match) => [match[1], match[0]]));
  let nextSlideNumber = Math.max(255, ...[...existingSlideEntries.values()].map((entry) => Number(/\bid="(\d+)"/.exec(entry)?.[1]) || 0)) + 1;
  const orderedSlideEntries = document.slides.map((slide) => {
    const relationshipId = relationshipIdForPath.get(slide.path)!;
    return existingSlideEntries.get(relationshipId) ?? `<p:sldId id="${nextSlideNumber++}" r:id="${relationshipId}"/>`;
  });
  const nextPresentation = presentation.replace(/(<p:sldIdLst\b[^>]*>)[\s\S]*?(<\/p:sldIdLst>)/, (_entry, openingTag: string, closingTag: string) => `${openingTag}${orderedSlideEntries.join("")}${closingTag}`);
  const keptRelationships = relationships.replace(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\/?>(?:<\/Relationship>)?/g, (entry, relationshipId: string) => removedRelationshipIds.has(relationshipId) ? "" : entry);
  const nextRelationships = addedRelationships.length
    ? keptRelationships.replace("</Relationships>", `${addedRelationships.map(([id, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${target}"/>`).join("")}</Relationships>`)
    : keptRelationships;
  zip.file(presentationPath, nextPresentation);
  zip.file(presentationRelationshipsPath, nextRelationships);

  for (const [relationshipId, target] of targets) {
    if (!removedRelationshipIds.has(relationshipId)) continue;
    const path = `ppt/${target.replace(/^\.\//, "")}`;
    zip.remove(path);
    zip.remove(path.replace(/([^/]+)$/, "_rels/$1.rels"));
  }
  const addedSlidePaths = new Set(addedRelationships.map(([, target]) => `ppt/${target}`));
  for (const slide of document.slides) {
    let xml = slide.xml;
    for (const element of slide.elements) xml = replaceElement(xml, element);
    zip.file(slide.path, xml);
    if (addedSlidePaths.has(slide.path)) {
      zip.file(slide.path.replace(/([^/]+)$/, "_rels/$1.rels"), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    }
  }
  if (addedRelationships.length) {
    const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
    if (contentTypes) {
      const overrides = addedRelationships.map(([, target]) => `<Override PartName="/ppt/${target}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
      zip.file("[Content_Types].xml", contentTypes.replace("</Types>", `${overrides}</Types>`));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "STORE" });
}
