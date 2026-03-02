import { motion } from 'motion/react';
import { Button } from '@/layers/shared/ui';

export interface OnboardingCompleteProps {
  onComplete: () => void;
}

/**
 * Completion screen shown after all onboarding steps.
 *
 * Displays a summary message and a prominent call-to-action to start
 * the first session. Scales in on mount for a subtle entrance effect.
 *
 * @param onComplete - Called when the user clicks "Start a session"
 */
export function OnboardingComplete({ onComplete }: OnboardingCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 text-center"
    >
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          You're all set!
        </h2>
        <p className="text-muted-foreground">
          Your workspace is configured and ready. Discovered agents,
          scheduled tasks, and connected adapters will appear as you use
          DorkOS.
        </p>
      </div>

      <Button size="lg" onClick={onComplete}>
        Start a session
      </Button>
    </motion.div>
  );
}
