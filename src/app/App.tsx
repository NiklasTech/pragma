import { useEffect } from "react";
import { Layout } from "@/modules/layout";
import { WindowResizeHandles } from "@/components/layout/WindowResizeHandles";
import { Toaster } from "@/components/ui/sonner";
import { useOpenFile } from "@/hooks/useOpenFile";
import { useSaveFile } from "@/hooks/useSaveFile";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export default function App() {
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

      if (isOpenShortcut) {
        e.preventDefault();
        void openFile();
      } else if (isSaveShortcut) {
        e.preventDefault();
        void saveFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openFile, saveFile]);

  return (
    <>
      <WindowResizeHandles />
      <Layout />
      <Toaster position="bottom-right" />
    </>
  );
}
