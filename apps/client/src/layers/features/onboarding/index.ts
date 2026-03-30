/**
 * Onboarding feature — hooks for first-time user experience state management.
 *
 * @module features/onboarding
 */
export { useOnboarding } from './model/use-onboarding';
export { useTaskTemplates } from '@/layers/entities/tasks';
export type { TaskTemplate } from '@/layers/entities/tasks';
export { TaskTemplateCard } from '@/layers/features/tasks';
export { OnboardingFlow } from './ui/OnboardingFlow';
export { WelcomeStep } from './ui/WelcomeStep';
export { MeetDorkBotStep } from './ui/MeetDorkBotStep';
export { AgentDiscoveryStep } from './ui/AgentDiscoveryStep';
export { NoAgentsFound } from './ui/NoAgentsFound';
export { TaskTemplatesStep } from './ui/TaskTemplatesStep';
export { AdapterSetupStep } from './ui/AdapterSetupStep';
export { OnboardingComplete } from './ui/OnboardingComplete';
export { DiscoveryCelebration } from './ui/DiscoveryCelebration';
export { ProgressCard } from './ui/ProgressCard';
