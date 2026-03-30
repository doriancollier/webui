import { useState } from 'react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { Button } from '@/layers/shared/ui';
import {
  OnboardingFlow,
  WelcomeStep,
  MeetDorkBotStep,
  AgentDiscoveryStep,
  TaskTemplatesStep,
  AdapterSetupStep,
  OnboardingComplete,
  OnboardingNavBar,
  ProgressCard,
  NoAgentsFound,
  DiscoveryCelebration,
} from '@/layers/features/onboarding';
import type { DiscoveryCandidate, AgentPathEntry } from '@dorkos/shared/mesh-schemas';

// ── Mock data ────────────────────────────────────────────────

const MOCK_CANDIDATES: DiscoveryCandidate[] = [
  {
    path: '/Users/kai/projects/webapp/.claude',
    strategy: 'filesystem',
    hints: {
      suggestedName: 'webapp-agent',
      detectedRuntime: 'claude-code',
      inferredCapabilities: ['code-review', 'testing'],
      description: 'Web application development agent',
    },
    discoveredAt: '2026-03-17T10:30:00Z',
  },
  {
    path: '/Users/kai/projects/api-server/.cursor',
    strategy: 'filesystem',
    hints: {
      suggestedName: 'api-agent',
      detectedRuntime: 'cursor',
      inferredCapabilities: ['deployment'],
      description: 'API server maintenance agent',
    },
    discoveredAt: '2026-03-17T10:30:01Z',
  },
  {
    path: '/Users/kai/projects/ml-pipeline/.claude',
    strategy: 'filesystem',
    hints: {
      suggestedName: 'ml-agent',
      detectedRuntime: 'claude-code',
      inferredCapabilities: ['data-processing', 'monitoring'],
      description: 'ML pipeline orchestration agent',
    },
    discoveredAt: '2026-03-17T10:30:02Z',
  },
];

const MOCK_AGENTS: AgentPathEntry[] = [
  {
    id: 'webapp-agent',
    name: 'webapp-agent',
    projectPath: '/Users/kai/projects/webapp',
  },
  {
    id: 'api-agent',
    name: 'api-agent',
    projectPath: '/Users/kai/projects/api-server',
  },
];

const noop = () => {};

// ── Showcases ────────────────────────────────────────────────

/** Comprehensive onboarding showcases — full flow, individual steps, and supporting components. */
export function OnboardingFlowShowcases() {
  return (
    <>
      <InteractiveFlowShowcase />
      <WelcomeStepShowcase />
      <MeetDorkBotStepShowcase />
      <AgentDiscoveryStepShowcase />
      <TaskTemplatesStepShowcase />
      <AdapterSetupStepShowcase />
      <OnboardingCompleteShowcase />
      <OnboardingNavBarShowcase />
      <ProgressCardShowcase />
      <NoAgentsFoundShowcase />
      <DiscoveryCelebrationShowcase />
    </>
  );
}

// ── Full flow ────────────────────────────────────────────────

function InteractiveFlowShowcase() {
  const [flowKey, setFlowKey] = useState(0);

  return (
    <PlaygroundSection
      title="OnboardingFlow"
      description="Full interactive onboarding flow. Click through each step — Welcome, Meet DorkBot, Agent Discovery, Tasks, and Complete. Rendered in a contained viewport."
    >
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setFlowKey((k) => k + 1)}>
          Restart flow
        </Button>
        <span className="text-muted-foreground text-xs">
          Some steps may show loading states due to mock transport
        </span>
      </div>
      <ShowcaseDemo>
        <div className="border-border bg-background relative h-[600px] overflow-hidden rounded-lg border">
          <OnboardingFlow key={flowKey} onComplete={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ── Individual steps ─────────────────────────────────────────

function WelcomeStepShowcase() {
  return (
    <PlaygroundSection
      title="WelcomeStep"
      description="Initial welcome screen with word-by-word heading animation, preview items, and Get Started / Skip actions."
    >
      <ShowcaseDemo responsive>
        <div className="flex min-h-[400px] items-center justify-center">
          <WelcomeStep onGetStarted={noop} onSkip={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function MeetDorkBotStepShowcase() {
  return (
    <PlaygroundSection
      title="MeetDorkBotStep"
      description="DorkBot personality customization with trait sliders, avatar breathing animation, and live preview text. Sliders are fully interactive."
    >
      <ShowcaseDemo responsive>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <MeetDorkBotStep onStepComplete={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function AgentDiscoveryStepShowcase() {
  return (
    <PlaygroundSection
      title="AgentDiscoveryStep"
      description="Agent discovery with auto-scan. In the playground this shows the scanning animation (mock transport has no real scan results)."
    >
      <ShowcaseDemo responsive>
        <div className="flex min-h-[300px] flex-col px-4 py-4">
          <AgentDiscoveryStep onStepComplete={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function TaskTemplatesStepShowcase() {
  return (
    <PlaygroundSection
      title="TaskTemplatesStep"
      description="Task schedule template selection. Shown with mock agents — the template list loads from the mock transport."
    >
      <ShowcaseLabel>With 2 agents</ShowcaseLabel>
      <ShowcaseDemo responsive>
        <div className="min-h-[300px] py-4">
          <TaskTemplatesStep onStepComplete={noop} agents={MOCK_AGENTS} />
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>With 1 agent (auto-resolved)</ShowcaseLabel>
      <ShowcaseDemo responsive>
        <div className="min-h-[200px] py-4">
          <TaskTemplatesStep onStepComplete={noop} agents={[MOCK_AGENTS[0]]} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function AdapterSetupStepShowcase() {
  return (
    <PlaygroundSection
      title="AdapterSetupStep"
      description="Adapter connection step showing available communication channels (Telegram, Slack, Webhook). Currently not in the active flow but fully implemented."
    >
      <ShowcaseDemo responsive>
        <div className="py-4">
          <AdapterSetupStep onStepComplete={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function OnboardingCompleteShowcase() {
  return (
    <PlaygroundSection
      title="OnboardingComplete"
      description="Completion screen with word-by-word heading animation, step summary cards, and confetti. Fires confetti on mount."
    >
      <OnboardingCompleteInner />
    </PlaygroundSection>
  );
}

function OnboardingCompleteInner() {
  const [remountKey, setRemountKey] = useState(0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRemountKey((k) => k + 1)}
        className="mb-3"
      >
        Replay animation
      </Button>
      <ShowcaseDemo>
        <div className="flex min-h-[400px] items-center justify-center">
          <OnboardingComplete key={remountKey} onComplete={noop} />
        </div>
      </ShowcaseDemo>
    </>
  );
}

// ── Supporting components ────────────────────────────────────

function OnboardingNavBarShowcase() {
  const [step, setStep] = useState(1);

  return (
    <PlaygroundSection
      title="OnboardingNavBar"
      description="Step navigation bar with Back, animated step indicator dots, and Skip / Skip all controls. Click Back/Skip to cycle through steps."
    >
      <ShowcaseLabel>{`3 steps, current: ${step}`}</ShowcaseLabel>
      <ShowcaseDemo>
        <OnboardingNavBar
          totalSteps={3}
          currentStep={step}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onSkip={() => setStep((s) => Math.min(2, s + 1))}
          onSkipAll={noop}
        />
      </ShowcaseDemo>

      <ShowcaseLabel>5 steps, current: 0</ShowcaseLabel>
      <ShowcaseDemo>
        <OnboardingNavBar
          totalSteps={5}
          currentStep={0}
          onBack={noop}
          onSkip={noop}
          onSkipAll={noop}
        />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function ProgressCardShowcase() {
  return (
    <PlaygroundSection
      title="ProgressCard"
      description="Compact sidebar card showing remaining onboarding steps. Renders with the current onboarding state from the mock transport."
    >
      <ShowcaseDemo>
        <div className="mx-auto max-w-xs">
          <ProgressCard onStepClick={noop} onDismiss={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function NoAgentsFoundShowcase() {
  return (
    <PlaygroundSection
      title="NoAgentsFound"
      description="Fallback form shown when discovery finds zero agents. Includes directory picker, name input, and persona textarea."
    >
      <ShowcaseDemo responsive>
        <NoAgentsFound onAgentCreated={noop} />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

function DiscoveryCelebrationShowcase() {
  const [remountKey, setRemountKey] = useState(0);

  return (
    <PlaygroundSection
      title="DiscoveryCelebration"
      description="Three-beat celebration animation after agent discovery. Beat 1: cards stagger in. Beat 2: confetti + announcement. Beat 3: fade out."
    >
      <ShowcaseLabel>With 3 discovered candidates</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setRemountKey((k) => k + 1)}>
            Replay animation
          </Button>
          <DiscoveryCelebration key={remountKey} candidates={MOCK_CANDIDATES} onComplete={noop} />
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}
