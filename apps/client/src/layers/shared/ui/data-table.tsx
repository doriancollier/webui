import { useMemo } from 'react';
import {
  type ColumnDef,
  type RowData,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type TableOptions,
} from '@tanstack/react-table';
import { useIsMobile } from '@/layers/shared/model';
import { cn } from '@/layers/shared/lib';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// ---------------------------------------------------------------------------
// Module augmentation — allow column meta to declare responsive visibility.
// Any column with `meta: { hideOnMobile: true }` is automatically hidden
// when the viewport is below the mobile breakpoint (768 px).
// ---------------------------------------------------------------------------

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Hide this column on viewports below the mobile breakpoint (768 px). */
    hideOnMobile?: boolean;
  }
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

/** Props for the generic DataTable component. */
interface DataTableProps<TData, TValue> {
  /** TanStack Table column definitions. */
  columns: ColumnDef<TData, TValue>[];
  /** Data rows to render. */
  data: TData[];
  /** Message shown when data is empty. */
  emptyMessage?: string;
  /** Additional TanStack Table options (sorting, selection, pagination, etc.). */
  tableOptions?: Partial<Omit<TableOptions<TData>, 'data' | 'columns' | 'getCoreRowModel'>>;
  /** Optional className for the outer wrapper div. */
  className?: string;
}

/** Extract the stable column ID from a column definition. */
function getColumnId<TData, TValue>(col: ColumnDef<TData, TValue>): string | undefined {
  if ('id' in col && col.id) return col.id;
  if ('accessorKey' in col && typeof col.accessorKey === 'string') return col.accessorKey;
  return undefined;
}

/**
 * Generic data table powered by TanStack Table.
 *
 * Handles the core rendering loop: header groups → header cells, data rows →
 * visible cells, and an empty-state row when no data is present. Pass
 * `tableOptions` to enable sorting, selection, pagination, or other TanStack
 * Table features.
 *
 * Columns with `meta: { hideOnMobile: true }` are automatically hidden on
 * viewports below 768 px. User-provided `columnVisibility` in `tableOptions`
 * takes precedence per-column.
 */
function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'No results.',
  tableOptions,
  className,
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile();

  // Auto-compute column visibility from meta.hideOnMobile
  const responsiveVisibility = useMemo(() => {
    if (!isMobile) return {};
    const vis: Record<string, boolean> = {};
    for (const col of columns) {
      const id = getColumnId(col);
      if (id && col.meta?.hideOnMobile) {
        vis[id] = false;
      }
    }
    return vis;
  }, [columns, isMobile]);

  // Merge responsive defaults with any user-provided visibility (user wins)
  const mergedVisibility = useMemo(
    () => ({
      ...responsiveVisibility,
      ...(tableOptions?.state?.columnVisibility ?? {}),
    }),
    [responsiveVisibility, tableOptions?.state?.columnVisibility]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableOptions,
    state: {
      ...tableOptions?.state,
      columnVisibility: mergedVisibility,
    },
  });

  return (
    <div data-slot="data-table" className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getVisibleLeafColumns().length}
                className="h-24 text-center"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataTable };
export type { DataTableProps };
