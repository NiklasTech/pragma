import { ArrowDown, ArrowRight, ArrowUp, Bug, Pause, Play, Stop } from "@phosphor-icons/react";
import { useDebugStore } from "../store";
import { debugCurrentFile } from "../debugCurrentFile";
import { ToolbarButton } from "./DebugPanelParts";

export function DebugToolbar() {
  const status = useDebugStore((state) => state.status);
  const isStopped = useDebugStore((state) => state.isStopped);
  const continueSession = useDebugStore((state) => state.continueSession);
  const pauseSession = useDebugStore((state) => state.pauseSession);
  const stepOver = useDebugStore((state) => state.stepOver);
  const stepInto = useDebugStore((state) => state.stepInto);
  const stepOut = useDebugStore((state) => state.stepOut);
  const stopSession = useDebugStore((state) => state.stopSession);

  const isRunning = status === "running";

  return (
    <>
      <ToolbarButton
        icon={Bug}
        title="Debug Current File"
        disabled={status === "running" || status === "starting"}
        onClick={() => void debugCurrentFile()}
      />
      <ToolbarButton
        icon={Play}
        title="Continue"
        disabled={!isRunning || !isStopped}
        onClick={() => void continueSession()}
      />
      <ToolbarButton
        icon={Pause}
        title="Pause"
        disabled={!isRunning || isStopped}
        onClick={() => void pauseSession()}
      />
      <ToolbarButton
        icon={ArrowRight}
        title="Step Over"
        disabled={!isStopped}
        onClick={() => void stepOver()}
      />
      <ToolbarButton
        icon={ArrowDown}
        title="Step Into"
        disabled={!isStopped}
        onClick={() => void stepInto()}
      />
      <ToolbarButton
        icon={ArrowUp}
        title="Step Out"
        disabled={!isStopped}
        onClick={() => void stepOut()}
      />
      <ToolbarButton
        icon={Stop}
        title="Stop"
        disabled={status !== "running" && status !== "starting"}
        onClick={() => void stopSession()}
      />
    </>
  );
}
