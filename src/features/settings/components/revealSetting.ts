const HIGHLIGHT_CLASS = "bg-accent-subtle";
const HIGHLIGHT_MS = 1600;
// Pages render lazily, so the target is looked for over a few frames.
const MAX_FRAMES = 30;

export function normalizeSettingText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/// The element whose own text is `target`, for example the label of a setting row or a section title.
function findSettingLabel(root: HTMLElement, target: string): HTMLElement | null {
  const wanted = normalizeSettingText(target);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && normalizeSettingText(node.textContent ?? "") === wanted) {
      return node.parentElement;
    }
  }
  return null;
}

/// Scrolls the setting labeled `target` into view and briefly highlights its row; returns a cleanup.
export function revealSetting(root: HTMLElement, target: string): () => void {
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const attempt = (framesLeft: number) => {
    const label = findSettingLabel(root, target);
    if (!label) {
      if (framesLeft > 0) frame = requestAnimationFrame(() => attempt(framesLeft - 1));
      return;
    }
    const row = label.closest<HTMLElement>("[data-setting-row]") ?? label.parentElement ?? label;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    row.classList.add("rounded-md", "transition-colors", HIGHLIGHT_CLASS);
    timer = setTimeout(() => row.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
  };

  attempt(MAX_FRAMES);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
