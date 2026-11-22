import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { getIsMac } from "@/shared/lib/shortcuts";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOnboardingStore } from "@/shared/stores/onboarding";
import { useSettingsStore } from "@/shared/stores/settings";

import { OnboardingWelcome } from "./OnboardingWelcome";
import { AgentsBlock, useApiKeyReady, useSignedInAgents } from "./setup/AgentsBlock";
import { LanguagesBlock } from "./setup/LanguagesBlock";
import { LookBlock, useLookLabel } from "./setup/LookBlock";
import { ProjectBlock } from "./setup/ProjectBlock";
import { SetupBlock } from "./setup/SetupBlock";
import { SectionCell, SetupRail } from "./setup/SetupRail";
import {
  canStart,
  SECTION_HINTS,
  SETUP_SECTIONS,
  setupSections,
  type SetupSection,
} from "./setup/setupSections";
import { useProjectLanguages } from "./setup/useProjectLanguages";

const WELCOME_HINT = "press enter to set up Pragma, or esc to go straight in";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function inDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[role=dialog], [role=alertdialog]") !== null;
}

/// First launch: a short welcome, then every setup choice on one page.
export function Onboarding() {
  const { skip, complete } = useOnboardingStore(
    useShallow((state) => ({ skip: state.skip, complete: state.complete })),
  );
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const lspOn = useSettingsStore((state) => state.experimental.lsp);
  const [screen, setScreen] = useState<"welcome" | "setup">("welcome");
  const [focus, setFocus] = useState<SetupSection>("agents");
  const isMac = getIsMac();

  const languages = useProjectLanguages(rootPath, lspOn);
  const sections = setupSections({
    themeLabel: useLookLabel(),
    signedInAgents: useSignedInAgents(),
    apiKeyReady: useApiKeyReady(),
    folderName: rootPath ? getWorkspaceName(rootPath) : null,
    languages: languages.state,
  });
  const ready = canStart(sections);
  const doneCount = SETUP_SECTIONS.filter((section) => sections[section].done).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || inDialog(event.target)) return;
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (event.key === "Escape") {
        event.preventDefault();
        void skip();
      } else if (event.key === "Enter" && mod && screen === "setup") {
        event.preventDefault();
        if (ready) void complete();
      } else if (event.key === "Enter" && screen === "welcome" && !isTyping(event.target)) {
        event.preventDefault();
        setScreen("setup");
      } else if (screen === "setup" && !mod && !event.altKey && !isTyping(event.target)) {
        const section = SETUP_SECTIONS[Number(event.key) - 1];
        if (section) setFocus(section);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [complete, isMac, ready, screen, skip]);

  const block = (section: SetupSection) => ({
    section,
    index: SETUP_SECTIONS.indexOf(section),
    focused: focus === section,
    onFocus: () => setFocus(section),
  });

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-bg-ground text-ui-base text-fg-default select-none">
      <div data-tauri-drag-region className="flex h-header shrink-0 items-center gap-3.5 px-4">
        {isMac && <div data-tauri-drag-region className="w-[52px] shrink-0 self-stretch" />}
        <PragmaMark className="size-5 text-fg-default" />
        <span className="font-mono text-ui-sm font-semibold">pragma</span>
        <span className="font-mono text-ui-sm text-fg-subtle">setup</span>
        <div data-tauri-drag-region className="flex-1 self-stretch" />
        {screen === "setup" && (
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="flex gap-[3px]">
              {SETUP_SECTIONS.map((section) => (
                <span
                  key={section}
                  className={
                    sections[section].done
                      ? "h-1.5 w-4 rounded-[2px] bg-status-success"
                      : "h-1.5 w-4 rounded-[2px] bg-border"
                  }
                />
              ))}
            </div>
            <span className="font-mono text-ui-xs text-fg-subtle">{doneCount} of 4 ready</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => void skip()} className="gap-2 font-mono">
          skip setup <Kbd>esc</Kbd>
        </Button>
      </div>

      {screen === "welcome" ? (
        <main className="mx-1.5 flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-well bg-bg-well p-8">
          <OnboardingWelcome onSetUp={() => setScreen("setup")} onSkip={() => void skip()} />
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 animate-in gap-1.5 px-1.5 duration-(--motion-slow) fade-in-0 slide-in-from-right-4 motion-reduce:animate-none">
          <SetupRail sections={sections} focus={focus} onFocus={setFocus} />
          <main className="flex min-w-0 flex-1 flex-col gap-3 rounded-well bg-bg-well p-[18px]">
            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
              <SetupBlock {...block("look")}>
                <LookBlock />
              </SetupBlock>
              <SetupBlock {...block("agents")}>
                <AgentsBlock />
              </SetupBlock>
              <SetupBlock {...block("project")}>
                <ProjectBlock />
              </SetupBlock>
              <SetupBlock {...block("languages")}>
                <LanguagesBlock project={languages} />
              </SetupBlock>
            </div>
            <div className="flex shrink-0 items-center gap-3.5">
              <div className="flex gap-3.5 font-mono text-ui-xs text-fg-subtle">
                <span className="flex items-center gap-1.5">
                  <Kbd>{isMac ? "⌘N" : "Ctrl+N"}</Kbd> new task
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>{isMac ? "⌘P" : "Ctrl+P"}</Kbd> go to
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>{isMac ? "⌘K" : "Ctrl+Alt+K"}</Kbd> command line
                </span>
              </div>
              <div className="flex-1" />
              {!ready && (
                <span className="flex items-center gap-2 text-ui-xs text-fg-subtle">
                  <SectionCell done={false} focused={false} />
                  sign in to one agent to start
                </span>
              )}
              <Button variant="outline" onClick={() => setScreen("welcome")}>
                Back
              </Button>
              <Button disabled={!ready} onClick={() => void complete()} className="gap-2.5">
                Start Pragma <Kbd>{isMac ? "⌘⏎" : "Ctrl+⏎"}</Kbd>
              </Button>
            </div>
          </main>
        </div>
      )}

      <div className="flex h-10 shrink-0 items-center gap-2.5 px-[18px] font-mono text-ui-xs text-fg-subtle">
        <span className="text-primary">›</span>
        <span className="min-w-0 flex-1 truncate">
          {screen === "welcome" ? WELCOME_HINT : SECTION_HINTS[focus]}
        </span>
        {screen === "setup" && (
          <span className="flex items-center gap-1.5">
            <Kbd>1-4</Kbd> section
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> skip
        </span>
      </div>
    </div>
  );
}
