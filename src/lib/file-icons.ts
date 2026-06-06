import {
  FileText,
  FileCode,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export function getFileIcon(name: string): Icon {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "rs":
    case "py":
    case "go":
    case "java":
    case "cpp":
    case "c":
    case "h":
    case "rb":
    case "php":
    case "swift":
    case "kt":
      return FileCode;
    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return FileArchive;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return FileImage;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return FileVideo;
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
      return FileAudio;
    default:
      return FileText;
  }
}
