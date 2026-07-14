import sanitizeHtml from "sanitize-html";

const LOCAL_IMAGE_PREFIX = "/uploads/well-history/";

export function buildPptSlideHtml(pageUrls: string[]) {
  return pageUrls
    .map((url, index) => `<figure data-ppt-page="${index + 1}"><img src="${url}" alt="PPT 第 ${index + 1} 页" /></figure>`)
    .join("");
}

export function sanitizeWellHistoryHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "strong", "em", "u", "ul", "ol", "li", "a", "img", "figure", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
      figure: ["data-ppt-page"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}

export function collectWellHistoryImageUrls(html: string) {
  const urls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  return [...new Set(urls.filter((url) => url.startsWith(LOCAL_IMAGE_PREFIX)))];
}
