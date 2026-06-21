import { Button } from "@/shared/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <span className="text-4xl font-bold text-primary">P</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-fg-default">Welcome to Pragma</h1>
        <p className="max-w-md text-ui-base text-fg-muted">
          Let&apos;s get you set up in just a few steps. You can customize your theme, connect an AI
          provider, and open your first project.
        </p>
      </div>
      <Button size="lg" onClick={onNext}>
        Get Started
      </Button>
    </div>
  );
}
