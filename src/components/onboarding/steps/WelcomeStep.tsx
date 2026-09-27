import { PragmaMark } from "@/shared/components/PragmaMark";
import { Button } from "@/shared/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <PragmaMark animation="intro" className="size-16 text-fg-default" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-fg-default">Welcome to Pragma</h1>
        <p className="max-w-md text-ui-base text-fg-muted">
          Let&apos;s get you set up in just a few steps. You can customize your theme, connect an AI
          provider, and open your first project.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="rounded-full px-6">
        Get Started
      </Button>
    </div>
  );
}
