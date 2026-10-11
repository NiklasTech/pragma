import { useShallow } from "zustand/react/shallow";
import { useState } from "react";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useOnboardingStore } from "@/shared/stores/onboarding";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ThemeStep } from "./steps/ThemeStep";
import { AISetupStep } from "./steps/AISetupStep";
import { ShortcutsStep } from "./steps/ShortcutsStep";
import { ProjectStep } from "./steps/ProjectStep";
import { LanguagesStep } from "./steps/LanguagesStep";

const STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "theme", title: "Theme" },
  { id: "ai", title: "AI" },
  { id: "shortcuts", title: "Shortcuts" },
  { id: "project", title: "Project" },
  { id: "languages", title: "Languages" },
];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { skip, complete } = useOnboardingStore(
    useShallow((s) => ({ skip: s.skip, complete: s.complete })),
  );
  const { selectRoot } = useFileExplorer();

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      void complete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    void skip();
  };

  const handleOpenFolder = async () => {
    await selectRoot();
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-chrome/95 p-6">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-3 px-8 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-ui-xs font-medium text-fg-muted">
              {STEPS[currentStep]?.title}
            </span>
            <span className="text-ui-xs text-fg-subtle tabular-nums">
              {currentStep + 1} / {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  index <= currentStep ? "bg-primary" : "bg-bg-hover",
                )}
                title={step.title}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[380px] px-8 py-8">
          {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
          {currentStep === 1 && <ThemeStep />}
          {currentStep === 2 && <AISetupStep onSkipStep={handleNext} />}
          {currentStep === 3 && <ShortcutsStep />}
          {currentStep === 4 && <ProjectStep onOpenFolder={handleOpenFolder} />}
          {currentStep === 5 && <LanguagesStep />}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle bg-bg-root/40 px-6 py-3.5">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip onboarding
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            {currentStep === 0 ? null : (
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? "Finish" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
