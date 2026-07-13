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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/80 p-6 backdrop-blur-lg">
      <div className="flex w-full max-w-xl flex-col rounded-2xl border border-border/40 bg-bg-surface/95 shadow-2xl shadow-black/20 glass-strong overflow-hidden">
        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-3">
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-ui-xs font-medium transition-all duration-base",
                  index === currentStep
                    ? "bg-primary/12 text-primary"
                    : "text-fg-subtle hover:text-fg-muted",
                  index < currentStep && "text-primary/70",
                )}
                title={step.title}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full text-[9px] font-bold transition-all",
                    index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : index < currentStep
                        ? "bg-primary/20 text-primary"
                        : "bg-bg-elevated text-fg-subtle",
                  )}
                >
                  {index < currentStep ? "✓" : index + 1}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>
          <span className="text-ui-xs text-fg-subtle">
            {currentStep + 1} / {STEPS.length}
          </span>
        </div>

        <div className="min-h-[360px] px-8 py-8">
          {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
          {currentStep === 1 && <ThemeStep />}
          {currentStep === 2 && <AISetupStep onSkipStep={handleNext} />}
          {currentStep === 3 && <ShortcutsStep />}
          {currentStep === 4 && <ProjectStep onOpenFolder={handleOpenFolder} />}
          {currentStep === 5 && <LanguagesStep />}
        </div>

        <div className="flex items-center justify-between border-t border-border/30 px-6 py-4 bg-bg-hover/30">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-fg-subtle">
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
