import { useId } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Button } from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';

interface OnboardingNavBarProps {
  /** Total number of steps. */
  totalSteps: number;
  /** Zero-based index of the active step. */
  currentStep: number;
  /** Called when the user clicks Back. */
  onBack: () => void;
  /** Called when the user clicks Skip. */
  onSkip: () => void;
  /** Called when the user clicks Skip all. */
  onSkipAll: () => void;
}

/**
 * Navigation bar for the onboarding flow — Back button, animated step
 * indicator dots, and Skip / Skip all controls.
 */
export function OnboardingNavBar({
  totalSteps,
  currentStep,
  onBack,
  onSkip,
  onSkipAll,
}: OnboardingNavBarProps) {
  const id = useId();

  return (
    <div className="grid grid-cols-3 items-center px-4 py-3 sm:px-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="justify-self-start">
        Back
      </Button>

      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="relative flex items-center justify-center">
            {i === currentStep ? (
              <motion.div
                layoutId={`step-indicator-${id}`}
                className="bg-primary flex h-2 w-6 items-center justify-center rounded-full"
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              />
            ) : i < currentStep ? (
              <div className="bg-primary/60 flex size-2 items-center justify-center rounded-full">
                <Check className="text-primary-foreground size-1.5" />
              </div>
            ) : (
              <div className={cn('ring-muted-foreground/30 size-2 rounded-full ring-1')} />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkipAll} className="text-muted-foreground">
          Skip all
        </Button>
      </div>
    </div>
  );
}
