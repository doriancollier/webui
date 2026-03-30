import { useState, useCallback } from 'react';
import { Bot } from 'lucide-react';
import { TRAIT_ORDER, DEFAULT_TRAITS, type TraitName } from '@dorkos/shared/trait-renderer';
import type { Traits } from '@dorkos/shared/mesh-schemas';
import { generateFirstMessage } from '@dorkos/shared/dorkbot-templates';
import { playSliderTick, playCelebration, cn } from '@/layers/shared/lib';
import { useAppStore } from '@/layers/shared/model';
import { Button, Slider } from '@/layers/shared/ui';
import { useUpdateAgent } from '@/layers/entities/agent';
import { useOnboarding } from '../model/use-onboarding';

/** Slider endpoint labels for the two extremes of each trait. */
const SLIDER_LABELS: Record<TraitName, { left: string; right: string }> = {
  tone: { left: 'Serious', right: 'Playful' },
  autonomy: { left: 'Ask first', right: 'Act alone' },
  caution: { left: 'Conservative', right: 'Bold' },
  communication: { left: 'Terse', right: 'Thorough' },
  creativity: { left: 'By the book', right: 'Inventive' },
};

interface MeetDorkBotStepProps {
  onStepComplete: () => void;
}

/**
 * Meet DorkBot onboarding step — personality trait sliders with avatar
 * breathing animation. Updates the existing DorkBot agent's traits.
 */
export function MeetDorkBotStep({ onStepComplete }: MeetDorkBotStepProps) {
  const [traits, setTraits] = useState<Traits>({ ...DEFAULT_TRAITS });
  const [isReacting, setIsReacting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const updateAgent = useUpdateAgent();
  const { config } = useOnboarding();
  const setDorkbotFirstMessage = useAppStore((s) => s.setDorkbotFirstMessage);

  const handleTraitChange = useCallback((traitName: TraitName, value: number) => {
    playSliderTick();
    setTraits((prev) => ({ ...prev, [traitName]: value }));
  }, []);

  const handleSliderPointerDown = useCallback(() => {
    setIsReacting(true);
  }, []);

  const handleSliderPointerUp = useCallback(() => {
    setTimeout(() => setIsReacting(false), 600);
  }, []);

  const handleContinue = useCallback(() => {
    setUpdateError(null);

    const defaultDir = config?.agents?.defaultDirectory || '~/.dork/agents';
    const agentPath = `${defaultDir}/dorkbot`;

    updateAgent.mutate(
      { path: agentPath, updates: { traits } },
      {
        onSuccess: () => {
          setDorkbotFirstMessage(generateFirstMessage(traits));
          playCelebration();
          onStepComplete();
        },
        onError: (error) => {
          setUpdateError(error instanceof Error ? error.message : 'Failed to update personality');
        },
      }
    );
  }, [traits, config, updateAgent, onStepComplete, setDorkbotFirstMessage]);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto py-4">
      {/* Avatar with breathing animation */}
      <div
        className={cn(
          'dorkbot-avatar bg-muted flex size-16 items-center justify-center rounded-2xl',
          isReacting && 'reacting'
        )}
        data-testid="dorkbot-avatar"
      >
        <Bot className="text-muted-foreground size-8" />
      </div>

      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Meet DorkBot</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Your system agent. Runs tasks, writes summaries, sets up and manages other agents, etc.
        </p>
        <p className="text-foreground max-w-sm text-sm font-medium">
          Shape DorkBot&rsquo;s personality to match your style.
        </p>
      </div>

      {/* Trait sliders */}
      <div className="w-full max-w-md space-y-5" data-testid="personality-sliders">
        {TRAIT_ORDER.map((traitName) => {
          const level = traits[traitName] ?? 3;
          const labels = SLIDER_LABELS[traitName];

          return (
            <div key={traitName} className="space-y-2">
              <div className="grid grid-cols-3 text-sm">
                <span className="text-muted-foreground">{labels.left}</span>
                <span className="text-center font-medium capitalize">{traitName}</span>
                <span className="text-muted-foreground text-right">{labels.right}</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[level]}
                onValueChange={([val]) => handleTraitChange(traitName, val)}
                onPointerDown={handleSliderPointerDown}
                onPointerUp={handleSliderPointerUp}
                aria-label={`${traitName} trait level`}
              />
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {updateError && (
        <p className="text-destructive text-sm" role="alert" data-testid="update-error">
          {updateError}
        </p>
      )}

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        disabled={updateAgent.isPending}
        className="mt-2"
        data-testid="continue-dorkbot"
      >
        {updateAgent.isPending ? 'Saving...' : 'Continue'}
      </Button>
    </div>
  );
}
