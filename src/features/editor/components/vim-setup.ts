import { Vim } from "@replit/codemirror-vim";

const saveCallbacks = new Set<() => void>();
const closeCallbacks = new Set<() => void>();

Vim.defineEx("write", "w", () => {
  saveCallbacks.forEach((cb) => cb());
});

Vim.defineEx("wq", "wq", () => {
  saveCallbacks.forEach((cb) => cb());
  closeCallbacks.forEach((cb) => cb());
});

export function registerVimSave(callback: () => void): () => void {
  saveCallbacks.add(callback);
  return () => saveCallbacks.delete(callback);
}

export function registerVimClose(callback: () => void): () => void {
  closeCallbacks.add(callback);
  return () => closeCallbacks.delete(callback);
}
