import { Terminal } from "@/features/terminal/components/Terminal";

export default function TerminalPanel({ panelId }: { panelId: string }) {
  return (
    <div className="h-full w-full p-2">
      <Terminal panelId={panelId} />
    </div>
  );
}
