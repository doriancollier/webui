import { motion } from 'motion/react';
import type { VisibleBackgroundTask } from '../model/use-background-tasks';
import { TaskDetailRow } from './TaskDetailRow';

interface TaskDetailPanelProps {
  tasks: VisibleBackgroundTask[];
  onStopTask: (taskId: string) => void;
}

/**
 * Expandable panel listing all background tasks with kill controls.
 *
 * Animates open/closed with a height transition. Each task is rendered
 * as a compact chip row via `TaskDetailRow`.
 */
export function TaskDetailPanel({ tasks, onStopTask }: TaskDetailPanelProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="border-border overflow-hidden border-t px-2 py-1.5"
    >
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskDetailRow key={task.taskId} task={task} onStop={() => onStopTask(task.taskId)} />
        ))}
      </div>
    </motion.div>
  );
}
