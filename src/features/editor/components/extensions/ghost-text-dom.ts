/// The first line of a suggestion and the rest, which starts with its line break.
export function splitFirstLine(text: string): [string, string] {
  const newline = text.indexOf("\n");
  return newline === -1 ? [text, ""] : [text.slice(0, newline), text.slice(newline)];
}

/// The suggestion as grey text, with a "Tab accept" hint after its first line.
export function ghostTextDom(
  text: string,
  count: string | null,
  onAccept: () => void,
): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-ghost-text";
  const [first, rest] = splitFirstLine(text);
  span.append(first);

  const hint = document.createElement("button");
  hint.type = "button";
  hint.className = "cm-ghost-text-accept";
  hint.setAttribute("aria-label", "Accept suggestion (Tab)");
  const key = document.createElement("kbd");
  key.textContent = "Tab";
  hint.append(key, "accept");
  // Keeps the editor focused, so the click does not move the cursor away from the suggestion.
  hint.addEventListener("mousedown", (event) => event.preventDefault());
  hint.addEventListener("click", (event) => {
    event.preventDefault();
    onAccept();
  });
  span.appendChild(hint);

  if (count) {
    const badge = document.createElement("span");
    badge.className = "cm-ghost-text-count";
    badge.textContent = count;
    span.appendChild(badge);
  }
  if (rest) span.append(rest);
  return span;
}
