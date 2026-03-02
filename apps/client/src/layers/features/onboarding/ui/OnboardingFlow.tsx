'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/layers/shared/ui';
import { useIsMobile } from '@/layers/shared/model';
import { useOnboarding } from '../model/use-onboarding';
import { AgentDiscoveryStep } from './AgentDiscoveryStep';
import { PulsePresetsStep } from './PulsePresetsStep';
import { AdapterSetupStep } from './AdapterSetupStep';
import { OnboardingComplete } from './OnboardingComplete';

const STEPS = ['discovery', 'pulse', 'adapters'] as const;

interface OnboardingFlowProps {
  onComplete: () => void;
  initialStep?: number;
}

/**
 * Full-screen onboarding container managing step navigation, skip controls,
 * and animated transitions between onboarding steps.
 *
 * @param onComplete - Called when onboarding finishes (last step or skip all)
 * @param initialStep - Zero-based index of the starting step (default: 0)
 */
export function OnboardingFlow({ onComplete, initialStep = 0 }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [showComplete, setShowComplete] = useState(false);
  const { completeStep, skipStep, dismiss, startOnboarding } = useOnboarding();
  const isMobile = useIsMobile();

  // Record onboarding start timestamp on mount
  useEffect(() => {
    startOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowComplete(true);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepComplete = useCallback(() => {
    completeStep(STEPS[currentStep]);
    goNext();
  }, [currentStep, completeStep, goNext]);

  const handleSkip = useCallback(() => {
    skipStep(STEPS[currentStep]);
    goNext();
  }, [currentStep, skipStep, goNext]);

  const handleSkipAll = useCallback(() => {
    dismiss();
    onComplete();
  }, [dismiss, onComplete]);

  // Show the completion screen
  if (showComplete) {
    return <OnboardingComplete onComplete={onComplete} />;
  }

  const slideDistance = isMobile ? 150 : 300;
  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? slideDistance : -slideDistance, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -slideDistance : slideDistance, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header with skip all */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {STEPS.length}
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkipAll}>
          Skip all
        </Button>
      </div>

      {/* Step indicator dots */}
      <div className="flex justify-center gap-2 pb-4 sm:pb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/40' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step content with slide transitions */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
              {currentStep === 0 && (
                <AgentDiscoveryStep onStepComplete={handleStepComplete} />
              )}
              {currentStep === 1 && (
                <PulsePresetsStep onStepComplete={handleStepComplete} />
              )}
              {currentStep === 2 && (
                <AdapterSetupStep onStepComplete={handleStepComplete} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
        <Button variant="ghost" onClick={goBack} disabled={currentStep === 0}>
          Back
        </Button>
        <Button variant="outline" onClick={handleSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
