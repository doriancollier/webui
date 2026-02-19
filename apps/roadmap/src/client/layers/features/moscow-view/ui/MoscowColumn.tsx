import { Droppable } from '@hello-pangea/dnd';
import type { RoadmapItem, Moscow } from '@dorkos/shared/roadmap-schemas';
import { MoscowCard } from './MoscowCard';

interface MoscowColumnConfig {
  moscow: Moscow;
  label: string;
  colorClass: string;
}

interface MoscowColumnProps {
  config: MoscowColumnConfig;
  items: RoadmapItem[];
}

/**
 * A droppable column in the MoSCoW grid view.
 *
 * Renders a color-coded header with the MoSCoW category label and item count,
 * followed by a list of draggable MoscowCard components.
 */
export function MoscowColumn({ config, items }: MoscowColumnProps) {
  const { moscow, label, colorClass } = config;

  return (
    <div className="flex flex-col min-h-0 rounded-lg border border-border bg-muted">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className={`text-sm font-semibold ${colorClass}`}>{label}</h2>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <Droppable droppableId={moscow}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'flex flex-col gap-2 flex-1 overflow-y-auto p-3',
              snapshot.isDraggingOver ? 'bg-accent' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {items.map((item, index) => (
              <MoscowCard key={item.id} item={item} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
