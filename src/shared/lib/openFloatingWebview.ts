import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function openFloatingWebview(options: {
  nodeId: string;
  title: string;
  width: number;
  height: number;
}): Promise<string> {
  const parent = getCurrentWindow();
  const label = options.nodeId.startsWith("floating-")
    ? options.nodeId
    : `floating-${options.nodeId}`;
  const url = `index.html?nodeId=${encodeURIComponent(options.nodeId)}&parent=${encodeURIComponent(parent.label)}`;

  const pos = await parent.outerPosition();
  const factor = await parent.scaleFactor();
  const x = Math.round(pos.x / factor + 48);
  const y = Math.round(pos.y / factor + 48);

  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.close();
    }
  } catch {
    // no existing window
  }

  const webview = new WebviewWindow(label, {
    url,
    title: options.title,
    width: Math.max(options.width, 320),
    height: Math.max(options.height, 240),
    x,
    y,
    decorations: true,
    resizable: true,
    visible: true,
    focus: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Timed out creating the native window"));
    }, 8000);
    void webview.once("tauri://created", () => {
      window.clearTimeout(timer);
      resolve();
    });
    void webview.once("tauri://error", (event) => {
      window.clearTimeout(timer);
      reject(new Error(JSON.stringify(event)));
    });
  });

  return label;
}
