import { useEffect } from "react";
import { Layout } from "@/shell/layout";
import { WindowResizeHandles } from "@/shell/chrome/WindowResizeHandles";
import { Toaster } from "@/shared/components/ui/sonner";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useLayoutStore } from "@/shell/layout";
import { useAIInit } from "@/shared/hooks/useAIInit";
import { ThemeProvider } from "@/theme";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export default function App() {
  useAIInit();

  const openFile = useOpenFile();
  const saveFile = useSaveFile();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isOpenShortcut = IS_MAC
        ? e.metaKey && !e.ctrlKey && !e.altKey && e.code === "KeyO"
        : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyO";

      const isSaveShortcut = IS_MAC
        ? e.metaKey && !e.ctrlKey && !e.altKey && e.code === "KeyS"
        : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyS";

      const isAIToggleShortcut = IS_MAC
        ? e.metaKey && e.shiftKey && e.code === "KeyA"
        : e.ctrlKey && e.shiftKey && e.code === "KeyA";

      if (isOpenShortcut) {
        e.preventDefault();
        void openFile();
      } else if (isSaveShortcut) {
        e.preventDefault();
        void saveFile();
      } else if (isAIToggleShortcut) {
        e.preventDefault();
        useLayoutStore.getState().toggleAI();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFile, saveFile]);

  return (
    <ThemeProvider>
      <WindowResizeHandles />
      <Layout />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
