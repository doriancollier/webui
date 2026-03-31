import { useState } from 'react';
import type { ColumnDef, SortingState, RowSelectionState } from '@tanstack/react-table';
import { getSortedRowModel } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  DataTable,
  Badge,
  Button,
  Checkbox,
  Skeleton,
} from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';

// ---------------------------------------------------------------------------
// Mock data types
// ---------------------------------------------------------------------------

interface MockAgent {
  id: string;
  name: string;
  namespace: string;
  status: 'online' | 'offline' | 'busy';
  sessions: number;
  lastActive: string;
}

interface MockActivity {
  id: string;
  time: string;
  actor: string;
  actorType: 'user' | 'agent' | 'system' | 'tasks';
  category: 'tasks' | 'relay' | 'agent' | 'config' | 'system';
  summary: string;
}

interface MockTaskRun {
  id: string;
  taskName: string;
  status: 'success' | 'failed' | 'running' | 'skipped';
  startedAt: string;
  duration: string;
  exitCode: number | null;
}

interface MockRelayMessage {
  id: string;
  time: string;
  adapter: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  status: 'delivered' | 'pending' | 'failed';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_AGENTS: MockAgent[] = [
  {
    id: 'dorkbot',
    name: 'DorkBot',
    namespace: 'system',
    status: 'online',
    sessions: 0,
    lastActive: '2 min ago',
  },
  {
    id: 'code-reviewer',
    name: 'CodeReviewer',
    namespace: 'dev',
    status: 'online',
    sessions: 3,
    lastActive: '5 min ago',
  },
  {
    id: 'research-agent',
    name: 'ResearchAgent',
    namespace: 'dev',
    status: 'busy',
    sessions: 1,
    lastActive: 'now',
  },
  {
    id: 'doc-writer',
    name: 'DocWriter',
    namespace: 'docs',
    status: 'offline',
    sessions: 0,
    lastActive: '2 hours ago',
  },
  {
    id: 'test-runner',
    name: 'TestRunner',
    namespace: 'ci',
    status: 'online',
    sessions: 5,
    lastActive: '12 min ago',
  },
  {
    id: 'deploy-bot',
    name: 'DeployBot',
    namespace: 'ci',
    status: 'offline',
    sessions: 0,
    lastActive: '1 day ago',
  },
];

const MOCK_ACTIVITIES: MockActivity[] = [
  {
    id: '1',
    time: '2:14 AM',
    actor: 'You',
    actorType: 'user',
    category: 'agent',
    summary: 'Started session with CodeReviewer',
  },
  {
    id: '2',
    time: '2:00 AM',
    actor: 'Tasks',
    actorType: 'tasks',
    category: 'tasks',
    summary: 'Health check completed — all agents responding',
  },
  {
    id: '3',
    time: '1:45 AM',
    actor: 'System',
    actorType: 'system',
    category: 'relay',
    summary: 'Slack adapter connected successfully',
  },
  {
    id: '4',
    time: '1:30 AM',
    actor: 'You',
    actorType: 'user',
    category: 'config',
    summary: 'Updated default agent timeout to 300s',
  },
  {
    id: '5',
    time: '1:15 AM',
    actor: 'ResearchAgent',
    actorType: 'agent',
    category: 'agent',
    summary: 'Completed research report: API rate limiting patterns',
  },
  {
    id: '6',
    time: '1:00 AM',
    actor: 'System',
    actorType: 'system',
    category: 'system',
    summary: 'Server started on port 6242',
  },
  {
    id: '7',
    time: '12:45 AM',
    actor: 'TestRunner',
    actorType: 'agent',
    category: 'agent',
    summary: 'Ran 147 tests — 146 passed, 1 skipped',
  },
  {
    id: '8',
    time: '12:30 AM',
    actor: 'Tasks',
    actorType: 'tasks',
    category: 'tasks',
    summary: 'Daily summary generated and saved to ~/.dork/reports/',
  },
];

const MOCK_TASK_RUNS: MockTaskRun[] = [
  {
    id: '1',
    taskName: 'Health Check',
    status: 'success',
    startedAt: '2:00 AM',
    duration: '2.3s',
    exitCode: 0,
  },
  {
    id: '2',
    taskName: 'Daily Summary',
    status: 'success',
    startedAt: '12:30 AM',
    duration: '45.1s',
    exitCode: 0,
  },
  {
    id: '3',
    taskName: 'Code Review',
    status: 'running',
    startedAt: '2:14 AM',
    duration: '—',
    exitCode: null,
  },
  {
    id: '4',
    taskName: 'Sync Docs',
    status: 'failed',
    startedAt: '12:15 AM',
    duration: '12.0s',
    exitCode: 1,
  },
  {
    id: '5',
    taskName: 'Cleanup Temp',
    status: 'skipped',
    startedAt: '—',
    duration: '—',
    exitCode: null,
  },
  {
    id: '6',
    taskName: 'Backup Config',
    status: 'success',
    startedAt: '12:00 AM',
    duration: '1.8s',
    exitCode: 0,
  },
];

const MOCK_RELAY_MESSAGES: MockRelayMessage[] = [
  {
    id: '1',
    time: '14:23:01',
    adapter: 'slack',
    direction: 'inbound',
    subject: 'Deploy complete',
    status: 'delivered',
  },
  {
    id: '2',
    time: '14:22:58',
    adapter: 'slack',
    direction: 'outbound',
    subject: 'Starting deploy...',
    status: 'delivered',
  },
  {
    id: '3',
    time: '14:20:12',
    adapter: 'telegram',
    direction: 'inbound',
    subject: 'Review PR #142',
    status: 'delivered',
  },
  {
    id: '4',
    time: '14:19:30',
    adapter: 'email',
    direction: 'outbound',
    subject: 'Daily summary',
    status: 'pending',
  },
  {
    id: '5',
    time: '14:15:00',
    adapter: 'slack',
    direction: 'outbound',
    subject: 'Test results',
    status: 'failed',
  },
  {
    id: '6',
    time: '14:10:45',
    adapter: 'telegram',
    direction: 'outbound',
    subject: 'Agent alert',
    status: 'delivered',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  online: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  offline: 'bg-neutral-500/10 text-neutral-500',
  busy: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  skipped: 'bg-neutral-500/10 text-neutral-500',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const CATEGORY_STYLES: Record<string, string> = {
  tasks: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  relay: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  agent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  config: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  system: 'bg-neutral-500/10 text-neutral-500',
};

const ACTOR_STYLES: Record<string, string> = {
  user: 'bg-muted text-muted-foreground',
  agent: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  system: 'bg-neutral-500/10 text-neutral-500',
  tasks: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

/** Status badge used across multiple showcase sections. */
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Basic Table
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  {
    capability: 'Code Review',
    description: 'Analyze PRs for bugs, style, and security issues',
    supported: true,
  },
  {
    capability: 'Test Generation',
    description: 'Generate unit and integration tests from source',
    supported: true,
  },
  {
    capability: 'Documentation',
    description: 'Write TSDoc, README, and architecture docs',
    supported: true,
  },
  {
    capability: 'Deployment',
    description: 'Build, deploy, and promote via Vercel CLI',
    supported: false,
  },
  { capability: 'Monitoring', description: 'Watch logs and alert on anomalies', supported: false },
];

function BasicTableSection() {
  return (
    <PlaygroundSection
      title="Basic Table"
      description="Raw Table primitives with semantic HTML — header, body, footer, and caption."
    >
      <ShowcaseLabel>Agent capabilities</ShowcaseLabel>
      <ShowcaseDemo>
        <Table>
          <TableCaption>Capabilities for the CodeReviewer agent.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Capability</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CAPABILITIES.map((cap) => (
              <TableRow key={cap.capability}>
                <TableCell className="font-medium">{cap.capability}</TableCell>
                <TableCell className="text-muted-foreground">{cap.description}</TableCell>
                <TableCell className="text-center">
                  {cap.supported ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      Supported
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      Planned
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total capabilities</TableCell>
              <TableCell className="text-center">{CAPABILITIES.length}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Sortable Data Table
// ---------------------------------------------------------------------------

function SortableHeader({
  column,
  children,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: () => void };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
      {children}
      <Icon className="ml-1 size-3.5" />
    </Button>
  );
}

const AGENT_COLUMNS: ColumnDef<MockAgent>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
  },
  {
    accessorKey: 'namespace',
    header: ({ column }) => <SortableHeader column={column}>Namespace</SortableHeader>,
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">{row.getValue('namespace')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'sessions',
    header: ({ column }) => <SortableHeader column={column}>Sessions</SortableHeader>,
    cell: ({ row }) => <span className="tabular-nums">{row.getValue('sessions')}</span>,
  },
  {
    accessorKey: 'lastActive',
    header: 'Last Active',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{row.getValue('lastActive')}</span>
    ),
  },
];

function SortableDataTableSection() {
  const [sorting, setSorting] = useState<SortingState>([]);

  return (
    <PlaygroundSection
      title="Sortable Data Table"
      description="TanStack Table with sortable column headers. Click Name, Namespace, or Sessions to sort."
    >
      <ShowcaseLabel>Agent fleet</ShowcaseLabel>
      <ShowcaseDemo>
        <DataTable
          columns={AGENT_COLUMNS}
          data={MOCK_AGENTS}
          tableOptions={{
            state: { sorting },
            onSortingChange: setSorting,
            getSortedRowModel: getSortedRowModel(),
          }}
        />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Activity Log
// ---------------------------------------------------------------------------

const ACTIVITY_COLUMNS: ColumnDef<MockActivity>[] = [
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-muted-foreground w-20 text-xs tabular-nums">
        {row.getValue('time')}
      </span>
    ),
  },
  {
    accessorKey: 'actor',
    header: 'Actor',
    cell: ({ row }) => (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          ACTOR_STYLES[row.original.actorType]
        )}
      >
        {row.getValue('actor')}
      </span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const cat = row.getValue('category') as string;
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
            CATEGORY_STYLES[cat]
          )}
        >
          {cat}
        </span>
      );
    },
  },
  {
    accessorKey: 'summary',
    header: 'Summary',
    cell: ({ row }) => (
      <span className="text-foreground/80 text-sm">{row.getValue('summary')}</span>
    ),
  },
];

function ActivityLogSection() {
  return (
    <PlaygroundSection
      title="Activity Log"
      description="Activity events in tabular format with actor and category badges. Demonstrates how the activity feed maps to a data table."
    >
      <ShowcaseLabel>Recent activity</ShowcaseLabel>
      <ShowcaseDemo>
        <DataTable columns={ACTIVITY_COLUMNS} data={MOCK_ACTIVITIES} />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Task Run History
// ---------------------------------------------------------------------------

const TASK_RUN_COLUMNS: ColumnDef<MockTaskRun>[] = [
  {
    accessorKey: 'taskName',
    header: 'Task',
    cell: ({ row }) => <span className="font-medium">{row.getValue('taskName')}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs tabular-nums">
        {row.getValue('startedAt')}
      </span>
    ),
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.getValue('duration')}</span>
    ),
  },
  {
    accessorKey: 'exitCode',
    header: 'Exit Code',
    cell: ({ row }) => {
      const code = row.getValue('exitCode') as number | null;
      if (code === null) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span
          className={cn(
            'font-mono text-xs',
            code === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {code}
        </span>
      );
    },
  },
];

function TaskRunHistorySection() {
  return (
    <PlaygroundSection
      title="Task Run History"
      description="Scheduled task execution history with status badges, duration, and exit codes."
    >
      <ShowcaseLabel>Recent task runs</ShowcaseLabel>
      <ShowcaseDemo>
        <DataTable columns={TASK_RUN_COLUMNS} data={MOCK_TASK_RUNS} />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Row Selection
// ---------------------------------------------------------------------------

const SELECTABLE_AGENT_COLUMNS: ColumnDef<MockAgent>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select ${row.original.name}`}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
  },
  {
    accessorKey: 'namespace',
    header: 'Namespace',
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">{row.getValue('namespace')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'sessions',
    header: 'Sessions',
    cell: ({ row }) => <span className="tabular-nums">{row.getValue('sessions')}</span>,
  },
];

function RowSelectionSection() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  return (
    <PlaygroundSection
      title="Row Selection"
      description="Checkbox-based row selection for bulk operations. Select all via the header checkbox."
    >
      <ShowcaseLabel>Selectable agent fleet</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="space-y-3">
          <DataTable
            columns={SELECTABLE_AGENT_COLUMNS}
            data={MOCK_AGENTS}
            tableOptions={{
              state: { rowSelection },
              onRowSelectionChange: setRowSelection,
              enableRowSelection: true,
            }}
          />
          <p className="text-muted-foreground text-xs">
            {selectedCount > 0
              ? `${selectedCount} of ${MOCK_AGENTS.length} agent(s) selected`
              : 'No agents selected'}
          </p>
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 6: Empty & Loading States
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyLoadingSection() {
  const [showLoading, setShowLoading] = useState(false);

  return (
    <PlaygroundSection
      title="Empty & Loading States"
      description="How tables handle zero data and skeleton loading states."
    >
      <ShowcaseLabel>Empty table</ShowcaseLabel>
      <ShowcaseDemo>
        <DataTable
          columns={AGENT_COLUMNS}
          data={[]}
          emptyMessage="No agents registered. Run 'dorkos scan' to discover agents."
        />
      </ShowcaseDemo>

      <ShowcaseLabel>Loading skeleton</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowLoading((v) => !v)}>
            {showLoading ? 'Show skeleton' : 'Show data'}
          </Button>
          {showLoading ? (
            <DataTable columns={AGENT_COLUMNS} data={MOCK_AGENTS.slice(0, 4)} />
          ) : (
            <TableSkeleton />
          )}
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 7: Compact & Striped
// ---------------------------------------------------------------------------

const RELAY_COLUMNS: ColumnDef<MockRelayMessage>[] = [
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.getValue('time')}</span>
    ),
  },
  {
    accessorKey: 'adapter',
    header: 'Adapter',
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('adapter')}</span>,
  },
  {
    accessorKey: 'direction',
    header: 'Dir',
    cell: ({ row }) => {
      const dir = row.getValue('direction') as string;
      return (
        <span
          className={cn(
            'text-xs font-medium',
            dir === 'inbound' ? 'text-blue-500' : 'text-emerald-500'
          )}
        >
          {dir === 'inbound' ? '← in' : '→ out'}
        </span>
      );
    },
  },
  {
    accessorKey: 'subject',
    header: 'Subject',
    cell: ({ row }) => <span className="text-sm">{row.getValue('subject')}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
];

function CompactStripedSection() {
  return (
    <PlaygroundSection
      title="Compact & Striped"
      description="Dense table variant with smaller padding and alternating row backgrounds — ideal for log-style data."
    >
      <ShowcaseLabel>Relay message log (compact)</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-2 text-xs">Time</TableHead>
                <TableHead className="h-8 px-2 text-xs">Adapter</TableHead>
                <TableHead className="h-8 px-2 text-xs">Dir</TableHead>
                <TableHead className="h-8 px-2 text-xs">Subject</TableHead>
                <TableHead className="h-8 px-2 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_RELAY_MESSAGES.map((msg, i) => (
                <TableRow key={msg.id} className={cn(i % 2 === 0 && 'bg-muted/30')}>
                  <TableCell className="px-2 py-1.5 font-mono text-xs tabular-nums">
                    {msg.time}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 font-mono text-xs">{msg.adapter}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        msg.direction === 'inbound' ? 'text-blue-500' : 'text-emerald-500'
                      )}
                    >
                      {msg.direction === 'inbound' ? '← in' : '→ out'}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-sm">{msg.subject}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    <StatusBadge status={msg.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Relay message log (DataTable)</ShowcaseLabel>
      <ShowcaseDemo>
        <DataTable columns={RELAY_COLUMNS} data={MOCK_RELAY_MESSAGES} />
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Section 8: Responsive Patterns
// ---------------------------------------------------------------------------

interface MockEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: string;
  latencyP50: string;
  latencyP99: string;
  rateLimit: string;
  status: 'healthy' | 'degraded' | 'down';
}

const MOCK_ENDPOINTS: MockEndpoint[] = [
  {
    id: '1',
    method: 'GET',
    path: '/api/sessions',
    handler: 'SessionController.list',
    latencyP50: '12ms',
    latencyP99: '45ms',
    rateLimit: '100/min',
    status: 'healthy',
  },
  {
    id: '2',
    method: 'POST',
    path: '/api/sessions/:id/message',
    handler: 'MessageController.send',
    latencyP50: '340ms',
    latencyP99: '2.1s',
    rateLimit: '30/min',
    status: 'healthy',
  },
  {
    id: '3',
    method: 'GET',
    path: '/api/mesh/topology',
    handler: 'MeshController.topology',
    latencyP50: '28ms',
    latencyP99: '120ms',
    rateLimit: '60/min',
    status: 'degraded',
  },
  {
    id: '4',
    method: 'DELETE',
    path: '/api/agents/:id',
    handler: 'AgentController.unregister',
    latencyP50: '8ms',
    latencyP99: '35ms',
    rateLimit: '10/min',
    status: 'healthy',
  },
  {
    id: '5',
    method: 'PUT',
    path: '/api/pulse/schedules/:id',
    handler: 'PulseController.update',
    latencyP50: '15ms',
    latencyP99: '90ms',
    rateLimit: '20/min',
    status: 'down',
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-blue-500',
  POST: 'text-emerald-500',
  PUT: 'text-amber-500',
  DELETE: 'text-red-500',
};

const RESPONSIVE_COLUMNS: ColumnDef<MockEndpoint>[] = [
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => {
      const method = row.getValue('method') as string;
      return (
        <span className={cn('text-xs font-bold', METHOD_COLORS[method] ?? 'text-foreground')}>
          {method}
        </span>
      );
    },
  },
  {
    accessorKey: 'path',
    header: 'Path',
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.getValue('path')}
        <span className="text-muted-foreground ml-2 font-sans text-xs sm:hidden">
          {row.original.handler.split('.')[1]}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'handler',
    header: 'Handler',
    meta: { hideOnMobile: true },
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">{row.getValue('handler')}</span>
    ),
  },
  {
    accessorKey: 'latencyP50',
    header: 'P50',
    meta: { hideOnMobile: true },
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.getValue('latencyP50')}</span>
    ),
  },
  {
    accessorKey: 'latencyP99',
    header: 'P99',
    meta: { hideOnMobile: true },
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.getValue('latencyP99')}</span>
    ),
  },
  {
    accessorKey: 'rateLimit',
    header: 'Rate Limit',
    meta: { hideOnMobile: true },
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{row.getValue('rateLimit')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
];

function ResponsivePatternsSection() {
  return (
    <PlaygroundSection
      title="Responsive & Mobile"
      description="Tables that adapt to small screens. Columns with meta.hideOnMobile are automatically hidden below 768 px. Resize the browser to see the effect."
    >
      <ShowcaseLabel>Column hiding via meta.hideOnMobile</ShowcaseLabel>
      <ShowcaseDemo>
        <p className="text-muted-foreground mb-3 text-xs">
          Handler, P50, P99, and Rate Limit columns hide on mobile. Resize your browser below 768 px
          to see them disappear. The Path column shows the handler method inline on mobile as a
          fallback.
        </p>
        <DataTable
          columns={RESPONSIVE_COLUMNS}
          data={MOCK_ENDPOINTS}
          emptyMessage="No endpoints."
        />
      </ShowcaseDemo>

      <ShowcaseLabel>Horizontal scroll fallback</ShowcaseLabel>
      <ShowcaseDemo>
        <p className="text-muted-foreground mb-3 text-xs">
          When all columns are important, the table container scrolls horizontally. The{' '}
          <code>{'<Table>'}</code> wrapper includes <code>overflow-auto</code> by default.
        </p>
        <div className="max-w-sm rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[80px]">Method</TableHead>
                <TableHead className="min-w-[200px]">Path</TableHead>
                <TableHead className="min-w-[180px]">Handler</TableHead>
                <TableHead className="min-w-[80px]">P50</TableHead>
                <TableHead className="min-w-[80px]">P99</TableHead>
                <TableHead className="min-w-[100px]">Rate Limit</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_ENDPOINTS.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        METHOD_COLORS[ep.method] ?? 'text-foreground'
                      )}
                    >
                      {ep.method}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{ep.path}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {ep.handler}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{ep.latencyP50}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{ep.latencyP99}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{ep.rateLimit}</TableCell>
                  <TableCell>
                    <StatusBadge status={ep.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ShowcaseDemo>

      <ShowcaseLabel>Stacked content on mobile</ShowcaseLabel>
      <ShowcaseDemo>
        <p className="text-muted-foreground mb-3 text-xs">
          For rich identity columns, stack secondary info below the primary text on small screens
          using <code>max-sm:hidden</code> or <code>sm:hidden</code> to toggle inline vs stacked
          layout.
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead className="max-sm:hidden">Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_ENDPOINTS.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            METHOD_COLORS[ep.method] ?? 'text-foreground'
                          )}
                        >
                          {ep.method}
                        </span>
                        <span className="truncate font-mono text-sm">{ep.path}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs max-sm:hidden">
                        {ep.handler}
                      </span>
                      <span className="text-muted-foreground block text-xs sm:hidden">
                        {ep.latencyP50} / {ep.latencyP99}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    <span className="font-mono text-xs tabular-nums">
                      {ep.latencyP50} / {ep.latencyP99}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ep.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ShowcaseDemo>
    </PlaygroundSection>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Table component showcases: primitives, data tables, sorting, selection, and domain-specific examples. */
export function TablesShowcases() {
  return (
    <>
      <BasicTableSection />
      <SortableDataTableSection />
      <ActivityLogSection />
      <TaskRunHistorySection />
      <RowSelectionSection />
      <EmptyLoadingSection />
      <CompactStripedSection />
      <ResponsivePatternsSection />
    </>
  );
}
