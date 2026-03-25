import type { LucideIcon } from 'lucide-react';

/** Placement slots where promos can render */
export type PromoPlacement = 'dashboard-main' | 'dashboard-sidebar' | 'agent-sidebar';

/** Props passed to dialog content components */
export interface PromoDialogProps {
  onClose: () => void;
}

/** Action types when user clicks the CTA */
export type PromoAction =
  | { type: 'dialog'; component: React.ComponentType<PromoDialogProps> }
  | { type: 'navigate'; to: string }
  | { type: 'action'; handler: () => void };

/** Content fields — slots pick which subset to render */
export interface PromoContent {
  icon: LucideIcon;
  title: string;
  shortDescription: string;
  ctaLabel: string;
}

/** Condition context injected into shouldShow */
export interface PromoContext {
  hasAdapter: (name: string) => boolean;
  isPulseEnabled: boolean;
  isMeshEnabled: boolean;
  isRelayEnabled: boolean;
  sessionCount: number;
  agentCount: number;
  daysSinceFirstUse: number;
}

/** Full promo definition */
export interface PromoDefinition {
  id: string;
  placements: PromoPlacement[];
  priority: number;
  shouldShow: (ctx: PromoContext) => boolean;
  content: PromoContent;
  action: PromoAction;
}
