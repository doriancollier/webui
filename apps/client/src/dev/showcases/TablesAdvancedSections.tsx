import { useState } from 'react';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DataTable,
  Button,
  Checkbox,
} from '@/layers/shared/ui';
import { cn } from '@/layers/shared/lib';
import {
  MOCK_AGENTS,
  MOCK_RELAY_MESSAGES,
  MOCK_ENDPOINTS,
  AGENT_COLUMNS,
  StatusBadge,
  TableSkeleton,
  METHOD_COLORS,
  type MockAgent,
  type MockRelayMessage,
  type MockEndpoint,
} from './tables-showcase-data';

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

/** Checkbox-based row selection for bulk operations. */
export function RowSelectionSection() {
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

/** Empty and skeleton loading state demos. */
export function EmptyLoadingSection() {
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

/** Compact table variant with striped rows. */
export function CompactStripedSection() {
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

/** Responsive table patterns with column hiding and stacked layouts. */
export function ResponsivePatternsSection() {
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
