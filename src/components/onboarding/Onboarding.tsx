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

const STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "theme", title: "Theme" },
  { id: "ai", title: "AI" },
  { id: "shortcuts", title: "Shortcuts" },
  { id: "project", title: "Project" },
];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { skip, complete } = useOnboardingStore();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-root/95 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-border/60 bg-bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  index === currentStep ? "bg-primary" : "bg-border",
                  index < currentStep && "bg-primary/60",
                )}
                title={step.title}
              />
            ))}
          </div>
          <span className="text-ui-xs text-fg-muted">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>

        <div className="min-h-[360px] px-8 py-8">
          {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
          {currentStep === 1 && <ThemeStep />}
          {currentStep === 2 && <AISetupStep onSkipStep={handleNext} />}
          {currentStep === 3 && <ShortcutsStep />}
          {currentStep === 4 && <ProjectStep onOpenFolder={handleOpenFolder} />}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
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
