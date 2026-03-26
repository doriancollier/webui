import { Zap, Clock, Plus } from 'lucide-react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { cn } from '@/layers/shared/lib';
import { Badge } from '@/layers/shared/ui/badge';
import { AgentAvatar } from '@/layers/entities/agent';

/* ---------------------------------------------------------------------------
 * Shared constants (mirrored from the real topology components)
 * --------------------------------------------------------------------------- */

const ADAPTER_STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  stopped: 'bg-zinc-400',
  error: 'bg-red-500',
};

const NAMESPACE_PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ec4899'];

/* ---------------------------------------------------------------------------
 * AgentNode visual replicas (using real AgentAvatar entity component)
 * --------------------------------------------------------------------------- */

interface AgentDemoData {
  label: string;
  emoji: string;
  avatarColor: string;
  healthStatus: 'active' | 'inactive' | 'stale' | 'unreachable';
  runtime: string;
  capabilities: string[];
  borderColor?: string;
  description?: string;
  relayAdapters?: string[];
  pulseScheduleCount?: number;
  budget?: { maxCallsPerHour: number; maxHopsPerMessage: number };
  behavior?: { responseMode: string };
  lastSeenAt?: string;
}

/** Compact pill (zoom < 0.6, ~120px). */
function AgentCompactPill({ d }: { d: AgentDemoData }) {
  return (
    <div
      className="bg-card flex w-[120px] items-center gap-1.5 rounded-full border px-2 py-0.5 shadow-sm"
      style={d.borderColor ? { borderLeft: `3px solid ${d.borderColor}` } : undefined}
    >
      <AgentAvatar color={d.avatarColor} emoji={d.emoji} healthStatus={d.healthStatus} size="xs" />
      <span className="text-foreground truncate text-xs font-medium">{d.label}</span>
    </div>
  );
}

/** Default card (zoom 0.6-1.2, ~200px). */
function AgentDefaultCard({ d }: { d: AgentDemoData }) {
  const hasRelay = d.relayAdapters && d.relayAdapters.length > 0;
  const hasPulse = d.pulseScheduleCount != null && d.pulseScheduleCount > 0;

  return (
    <div
      className="bg-card w-[200px] rounded-lg border px-3 py-2 shadow-sm"
      style={d.borderColor ? { borderLeft: `3px solid ${d.borderColor}` } : undefined}
    >
      <div className="flex items-center gap-2">
        <AgentAvatar
          color={d.avatarColor}
          emoji={d.emoji}
          healthStatus={d.healthStatus}
          size="sm"
        />
        <span className="text-foreground truncate text-sm font-medium">{d.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-[10px]">
          {d.runtime}
        </Badge>
        {d.capabilities.slice(0, 3).map((cap) => (
          <Badge key={cap} variant="outline" className="text-[10px]">
            {cap}
          </Badge>
        ))}
      </div>
      {(hasRelay || hasPulse) && (
        <div className="text-muted-foreground mt-1.5 flex items-center gap-2">
          {hasRelay && <Zap className="size-3" />}
          {hasPulse && (
            <span className="flex items-center gap-0.5">
              <Clock className="size-3" />
              <span className="text-[10px]">{d.pulseScheduleCount}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Expanded card (zoom > 1.2, ~240px). */
function AgentExpandedCard({ d }: { d: AgentDemoData }) {
  const hasRelay = d.relayAdapters && d.relayAdapters.length > 0;
  const hasPulse = d.pulseScheduleCount != null && d.pulseScheduleCount > 0;

  return (
    <div
      className="bg-card w-[240px] rounded-lg border px-3 py-2 shadow-sm"
      style={d.borderColor ? { borderLeft: `3px solid ${d.borderColor}` } : undefined}
    >
      <div className="flex items-center gap-2">
        <AgentAvatar
          color={d.avatarColor}
          emoji={d.emoji}
          healthStatus={d.healthStatus}
          size="sm"
        />
        <span className="text-foreground truncate text-sm font-medium">{d.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-[10px]">
          {d.runtime}
        </Badge>
        {d.capabilities.slice(0, 3).map((cap) => (
          <Badge key={cap} variant="outline" className="text-[10px]">
            {cap}
          </Badge>
        ))}
      </div>
      {d.description && (
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">{d.description}</p>
      )}
      {(hasRelay || hasPulse) && (
        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2">
          {hasRelay &&
            d.relayAdapters!.map((adapter) => (
              <span key={adapter} className="flex items-center gap-0.5">
                <Zap className="size-3" />
                <span className="text-[10px]">{adapter}</span>
              </span>
            ))}
          {hasPulse && (
            <span className="flex items-center gap-0.5">
              <Clock className="size-3" />
              <span className="text-[10px]">{d.pulseScheduleCount}</span>
            </span>
          )}
        </div>
      )}
      {d.budget && (
        <p className="text-muted-foreground mt-1 text-[10px]">
          {d.budget.maxCallsPerHour} calls/hr &middot; {d.budget.maxHopsPerMessage} max hops
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        {d.lastSeenAt && <span className="text-muted-foreground text-[10px]">{d.lastSeenAt}</span>}
        {d.behavior && (
          <Badge variant="outline" className="text-[10px]">
            {d.behavior.responseMode}
          </Badge>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * AdapterNode visual replicas
 * --------------------------------------------------------------------------- */

interface AdapterDemoData {
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  bindingCount: number;
  label?: string;
}

function AdapterDefaultCard({ d }: { d: AdapterDemoData }) {
  return (
    <div className="bg-card shadow-soft w-[200px] rounded-xl border p-4" style={{ minHeight: 100 }}>
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', ADAPTER_STATUS_COLORS[d.status])} />
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm font-medium">{d.label || d.name}</span>
          {d.label && <span className="text-muted-foreground truncate text-xs">{d.name}</span>}
        </div>
        <Badge variant="outline" className="text-muted-foreground ml-auto shrink-0 text-[10px]">
          Adapter
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-muted-foreground text-xs capitalize">{d.type}</span>
        {d.bindingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {d.bindingCount} {d.bindingCount === 1 ? 'binding' : 'bindings'}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AdapterCompactPill({ d }: { d: AdapterDemoData }) {
  return (
    <div className="bg-card flex w-[120px] items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm">
      <span className={cn('size-2 shrink-0 rounded-full', ADAPTER_STATUS_COLORS[d.status])} />
      <span className="text-foreground truncate text-xs font-medium">{d.label || d.name}</span>
    </div>
  );
}

function AdapterGhostPlaceholder() {
  return (
    <div
      className="border-muted-foreground/30 bg-card/40 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 opacity-40 transition-opacity hover:opacity-70"
      style={{ width: 200, height: 100 }}
      role="button"
      tabIndex={0}
    >
      <Plus className="text-muted-foreground size-4" />
      <span className="text-muted-foreground text-sm">Add Adapter</span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * NamespaceGroupNode visual replica
 * --------------------------------------------------------------------------- */

function NamespaceGroupDemo({
  namespace,
  agentCount,
  activeCount,
  color,
}: {
  namespace: string;
  agentCount: number;
  activeCount: number;
  color: string;
}) {
  return (
    <div
      className="bg-card/50 w-[260px] rounded-xl border-2"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}08`,
        minHeight: 80,
      }}
    >
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-1.5"
        style={{ backgroundColor: `${color}15` }}
      >
        <span className="text-xs font-semibold" style={{ color }}>
          {namespace}
        </span>
        <span className="text-muted-foreground text-[10px]">
          {activeCount}/{agentCount} agents
        </span>
        {activeCount > 0 && (
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <div className="px-3 py-3">
        <span className="text-muted-foreground text-xs italic">Agent nodes render here</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Mock data
 * --------------------------------------------------------------------------- */

const AGENTS: AgentDemoData[] = [
  {
    label: 'code-reviewer',
    emoji: '🔍',
    avatarColor: '#6366f1',
    healthStatus: 'active',
    runtime: 'claude-code',
    capabilities: ['code-review', 'testing', 'docs'],
    borderColor: NAMESPACE_PALETTE[0],
    description: 'Reviews pull requests and suggests improvements based on project conventions.',
    relayAdapters: ['slack'],
    pulseScheduleCount: 3,
    budget: { maxCallsPerHour: 60, maxHopsPerMessage: 3 },
    behavior: { responseMode: 'always' },
    lastSeenAt: '2m ago',
  },
  {
    label: 'deploy-bot',
    emoji: '🚀',
    avatarColor: '#f59e0b',
    healthStatus: 'inactive',
    runtime: 'cursor',
    capabilities: ['deployment', 'monitoring'],
    borderColor: NAMESPACE_PALETTE[0],
  },
  {
    label: 'data-pipeline',
    emoji: '📊',
    avatarColor: 'hsl(170, 70%, 55%)',
    healthStatus: 'stale',
    runtime: 'claude-code',
    capabilities: ['etl', 'analysis'],
    borderColor: NAMESPACE_PALETTE[1],
  },
  {
    label: 'test-runner',
    emoji: '🧪',
    avatarColor: 'hsl(280, 70%, 55%)',
    healthStatus: 'unreachable',
    runtime: 'codex',
    capabilities: ['testing'],
    borderColor: NAMESPACE_PALETTE[2],
  },
];

const ADAPTERS: AdapterDemoData[] = [
  { name: 'Slack Bot', type: 'slack', status: 'running', bindingCount: 3, label: 'Team Slack' },
  { name: 'Discord Bot', type: 'discord', status: 'stopped', bindingCount: 0 },
  { name: 'Telegram Bot', type: 'telegram', status: 'error', bindingCount: 1 },
];

/* ---------------------------------------------------------------------------
 * Showcase exports
 * --------------------------------------------------------------------------- */

/** Topology graph component showcases: AgentNode, AdapterNode, NamespaceGroupNode, edges, legend. */
export function TopologyShowcases() {
  return (
    <>
      {/* ── AgentNode ── */}
      <PlaygroundSection
        title="AgentNode"
        description="React Flow custom node with three LOD (level-of-detail) bands based on zoom level. Left border inherits agent or namespace color."
      >
        <ShowcaseLabel>Compact band (zoom &lt; 0.6)</ShowcaseLabel>
        <ShowcaseDemo>
          <div className="flex flex-wrap gap-3">
            {AGENTS.map((a) => (
              <AgentCompactPill key={a.label} d={a} />
            ))}
          </div>
        </ShowcaseDemo>

        <ShowcaseLabel>Default band (zoom 0.6–1.2)</ShowcaseLabel>
        <ShowcaseDemo>
          <div className="flex flex-wrap gap-4">
            {AGENTS.slice(0, 2).map((a) => (
              <AgentDefaultCard key={a.label} d={a} />
            ))}
          </div>
        </ShowcaseDemo>

        <ShowcaseLabel>Expanded band (zoom &gt; 1.2)</ShowcaseLabel>
        <ShowcaseDemo>
          <AgentExpandedCard d={AGENTS[0]} />
        </ShowcaseDemo>

        <ShowcaseLabel>Health statuses (via AgentAvatar ring)</ShowcaseLabel>
        <ShowcaseDemo>
          <div className="flex flex-wrap items-center gap-4">
            {(['active', 'inactive', 'stale', 'unreachable'] as const).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <AgentAvatar color="#6366f1" emoji="🤖" healthStatus={status} size="sm" />
                <span className="text-muted-foreground text-xs capitalize">{status}</span>
              </div>
            ))}
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>

      {/* ── AdapterNode ── */}
      <PlaygroundSection
        title="AdapterNode"
        description="React Flow custom node for relay adapters with two LOD bands and a ghost placeholder state."
      >
        <ShowcaseLabel>Default cards — all statuses</ShowcaseLabel>
        <ShowcaseDemo>
          <div className="flex flex-wrap gap-4">
            {ADAPTERS.map((a) => (
              <AdapterDefaultCard key={a.name} d={a} />
            ))}
          </div>
        </ShowcaseDemo>

        <ShowcaseLabel>Compact pills</ShowcaseLabel>
        <ShowcaseDemo>
          <div className="flex flex-wrap gap-3">
            {ADAPTERS.map((a) => (
              <AdapterCompactPill key={a.name} d={a} />
            ))}
          </div>
        </ShowcaseDemo>

        <ShowcaseLabel>Ghost placeholder (no adapters registered)</ShowcaseLabel>
        <ShowcaseDemo>
          <AdapterGhostPlaceholder />
        </ShowcaseDemo>
      </PlaygroundSection>

      {/* ── NamespaceGroupNode ── */}
      <PlaygroundSection
        title="NamespaceGroupNode"
        description="Compound container node that visually groups agent nodes within a namespace. Color-coded header bar with active/total badge."
      >
        <ShowcaseDemo>
          <div className="flex flex-wrap gap-4">
            <NamespaceGroupDemo
              namespace="production"
              agentCount={5}
              activeCount={3}
              color={NAMESPACE_PALETTE[0]}
            />
            <NamespaceGroupDemo
              namespace="staging"
              agentCount={2}
              activeCount={0}
              color={NAMESPACE_PALETTE[1]}
            />
            <NamespaceGroupDemo
              namespace="dev"
              agentCount={8}
              activeCount={8}
              color={NAMESPACE_PALETTE[2]}
            />
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>

      {/* ── Edge Styles ── */}
      <PlaygroundSection
        title="Edge Styles"
        description="Custom React Flow edges for bindings (adapter→agent), cross-namespace allow rules, and deny rules."
      >
        <ShowcaseDemo>
          <div className="flex flex-col gap-4">
            {/* Binding edge */}
            <div className="flex items-center gap-3">
              <svg width="80" height="8" className="shrink-0 overflow-visible">
                <line
                  x1="0"
                  y1="4"
                  x2="80"
                  y2="4"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  opacity="0.6"
                />
              </svg>
              <span className="text-muted-foreground text-xs">Binding (adapter → agent)</span>
            </div>
            {/* Cross-namespace allow */}
            <div className="flex items-center gap-3">
              <svg width="80" height="8" className="shrink-0 overflow-visible">
                <defs>
                  <marker
                    id="arrow-demo"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-primary)" />
                  </marker>
                </defs>
                <line
                  x1="0"
                  y1="4"
                  x2="74"
                  y2="4"
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  markerEnd="url(#arrow-demo)"
                />
              </svg>
              <span className="text-muted-foreground text-xs">Cross-namespace allow rule</span>
            </div>
            {/* Cross-namespace deny */}
            <div className="flex items-center gap-3">
              <svg width="80" height="8" className="shrink-0 overflow-visible">
                <line
                  x1="0"
                  y1="4"
                  x2="80"
                  y2="4"
                  stroke="var(--color-destructive)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
              </svg>
              <span className="text-muted-foreground text-xs">Cross-namespace deny rule</span>
            </div>
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>

      {/* ── TopologyLegend ── */}
      <PlaygroundSection
        title="TopologyLegend"
        description="Positioned panel at the bottom-left of the React Flow canvas showing edge types, health statuses, feature indicators, and namespace colors."
      >
        <ShowcaseDemo>
          <div className="bg-card/90 text-muted-foreground inline-flex flex-col gap-1.5 rounded-md border px-3 py-2 text-[11px] shadow-sm">
            {/* Edge types */}
            <div className="flex items-center gap-2">
              <svg width="24" height="4" className="shrink-0 overflow-visible">
                <line
                  x1="0"
                  y1="2"
                  x2="24"
                  y2="2"
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                />
                <circle cx="8" cy="2" r="2.5" fill="var(--color-primary)" opacity="0.9" />
              </svg>
              <span>Allow rule (data flow)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="24" height="4" className="shrink-0 overflow-visible">
                <line
                  x1="0"
                  y1="2"
                  x2="24"
                  y2="2"
                  stroke="var(--color-destructive)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              </svg>
              <span>Deny rule</span>
            </div>
            <div className="border-t" />
            {/* Health statuses */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-6 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-500/40" />
                <span className="relative h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-6 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span>Inactive</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-6 items-center justify-center">
                <span className="bg-muted-foreground/50 h-2 w-2 rounded-full" />
              </span>
              <span>Stale</span>
            </div>
            <div className="border-t" />
            {/* Feature indicators */}
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-6 items-center justify-center">
                <Zap className="h-3 w-3 text-yellow-500" />
              </span>
              <span>Relay-enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-6 items-center justify-center">
                <Clock className="h-3 w-3 text-blue-500" />
              </span>
              <span>Pulse schedules</span>
            </div>
            <div className="border-t" />
            {/* Namespace colors */}
            {NAMESPACE_PALETTE.map((color, i) => (
              <div key={color} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{['production', 'staging', 'dev', 'testing'][i]}</span>
              </div>
            ))}
            <div className="border-t" />
            <span className="text-[10px] italic opacity-60">Zoom in for more detail</span>
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>
    </>
  );
}
