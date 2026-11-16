import DOMPurify from "dompurify";

// DOMPurify's module export is a factory in DOM-like test environments. Resolve it
// when sanitizing (rather than at module evaluation) because Vitest installs its
// Happy-DOM window after dependencies may have begun evaluating.
type DOMPurifyFactory = (w: Window) => typeof DOMPurify;

function getPurify() {
  if (
    typeof window !== "undefined" &&
    typeof (DOMPurify as unknown as DOMPurifyFactory) === "function"
  ) {
    const instance = (DOMPurify as unknown as DOMPurifyFactory)(window);
    return instance;
  }

  return DOMPurify;
}

const CONTENTLESS_TAGS = new Set([
  "script",
  "style",
  "template",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "img",
]);

function allowlistedHtml(dirty: string, allowedTags: string[]): string {
  if (typeof document === "undefined") return "";

  const allowed = new Set(allowedTags.map((tag) => tag.toLowerCase()));
  const template = document.createElement("template");
  template.innerHTML = dirty;

  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (CONTENTLESS_TAGS.has(tag)) return "";

    const children = Array.from(element.childNodes).map(clean).join("");
    if (!allowed.has(tag)) return children;

    const className = element.getAttribute("class");
    const classAttribute = className
      ? ` class="${className.replace(/[&<>"']/g, (character) => {
          const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          };
          return entities[character];
        })}"`
      : "";
    return `<${tag}${classAttribute}>${children}</${tag}>`;
  };

  return Array.from(template.content.childNodes).map(clean).join("");
}

export function sanitizeHtml(
  dirty?: string,
  allowedTags: string[] = ["em", "b", "strong", "mark", "span"],
): string {
  if (!dirty) return "";
  const allowlisted = allowlistedHtml(dirty, allowedTags);
  return getPurify().sanitize(allowlisted, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ["class"],
  });
}
