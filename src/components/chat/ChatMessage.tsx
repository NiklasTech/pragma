import { User, Robot } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/15" : "bg-muted",
        )}
      >
        {isUser ? (
          <User size={14} className="text-primary" />
        ) : (
          <Robot size={14} className="text-muted-foreground" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}
