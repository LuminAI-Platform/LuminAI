import DOMPurify from "dompurify";

// In browser environments, DOMPurify is pre-bound to window.
// In environments where DOMPurify acts as a factory (such as Happy-DOM/JSDOM test suites),
// initialize it with the current global window.
type DOMPurifyFactory = (w: Window) => typeof DOMPurify;

const purify =
  typeof window !== "undefined" && typeof (DOMPurify as unknown as DOMPurifyFactory) === "function"
    ? (DOMPurify as unknown as DOMPurifyFactory)(window)
    : DOMPurify;

export function sanitizeHtml(
  dirty?: string,
  allowedTags: string[] = ["em", "b", "strong", "mark", "span"],
): string {
  if (!dirty) return "";
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ["class"],
  });
}
