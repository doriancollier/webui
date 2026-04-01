import {
  BasicTableSection,
  SortableDataTableSection,
  ActivityLogSection,
  TaskRunHistorySection,
} from './TablesBasicSections';
import {
  RowSelectionSection,
  EmptyLoadingSection,
  CompactStripedSection,
  ResponsivePatternsSection,
} from './TablesAdvancedSections';

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
