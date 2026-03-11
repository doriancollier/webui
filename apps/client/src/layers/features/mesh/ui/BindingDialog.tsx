import { useState, useEffect } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/layers/shared/ui';
import type { SessionStrategy } from '@dorkos/shared/relay-schemas';

/** Options for the session strategy selector with human-readable descriptions. */
const SESSION_STRATEGIES: { value: SessionStrategy; label: string; description: string }[] = [
  {
    value: 'per-chat',
    label: 'Per Chat',
    description:
      'One session per chat/conversation. Messages from the same chat resume the same session.',
  },
  {
    value: 'per-user',
    label: 'Per User',
    description:
      'One session per user. All messages from a user share a session across chats.',
  },
  {
    value: 'stateless',
    label: 'Stateless',
    description: 'Every message starts a new session. No conversation history.',
  },
];

/** Initial values for edit mode pre-population. */
export interface BindingDialogInitialValues {
  sessionStrategy: SessionStrategy;
  label: string;
}

export interface BindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human-readable name of the source adapter. */
  adapterName: string;
  /** Human-readable name of the target agent. */
  agentName: string;
  /** Called with the user's configuration when the confirm button is clicked. */
  onConfirm: (opts: { sessionStrategy: SessionStrategy; label: string }) => void;
  /** When set to 'edit', the dialog shows "Save Changes" instead of "Create Binding". */
  mode?: 'create' | 'edit';
  /** Pre-populate fields when editing an existing binding. */
  initialValues?: BindingDialogInitialValues;
}

/**
 * Modal dialog for configuring or editing an adapter-agent binding.
 *
 * In create mode (default), appears when the user drags from an adapter node
 * to an agent node on the topology canvas. In edit mode, pre-populates fields
 * with the existing binding's values.
 */
export function BindingDialog({
  open,
  onOpenChange,
  adapterName,
  agentName,
  onConfirm,
  mode = 'create',
  initialValues,
}: BindingDialogProps) {
  const [strategy, setStrategy] = useState<SessionStrategy>(initialValues?.sessionStrategy ?? 'per-chat');
  const [label, setLabel] = useState(initialValues?.label ?? '');

  // Sync state when initialValues change (e.g. selecting a different binding to edit)
  useEffect(() => {
    if (initialValues) {
      setStrategy(initialValues.sessionStrategy);
      setLabel(initialValues.label);
    }
  }, [initialValues]);

  const isEdit = mode === 'edit';
  const selectedStrategy = SESSION_STRATEGIES.find((s) => s.value === strategy);

  function handleConfirm() {
    onConfirm({ sessionStrategy: strategy, label });
    // Reset state for the next time the dialog opens (create mode only)
    if (!isEdit) {
      setStrategy('per-chat');
      setLabel('');
    }
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] max-w-md gap-0 p-0">
        <ResponsiveDialogHeader className="border-b px-4 py-3">
          <ResponsiveDialogTitle>{isEdit ? 'Edit Binding' : 'Create Binding'}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {isEdit ? 'Modify the binding configuration' : 'Configure how the adapter connects to the agent'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-5 overflow-y-auto px-4 py-5">
          {/* Adapter → Agent summary */}
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Binding:' : 'Connect'}{' '}
            <span className="font-medium text-foreground">{adapterName}</span>
            {' '}to{' '}
            <span className="font-medium text-foreground">{agentName}</span>
          </p>

          {/* Session strategy selector */}
          <div className="space-y-1.5">
            <Label htmlFor="binding-session-strategy">Session Strategy</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as SessionStrategy)}>
              <SelectTrigger id="binding-session-strategy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStrategy && (
              <p className="text-xs text-muted-foreground">{selectedStrategy.description}</p>
            )}
          </div>

          {/* Optional label */}
          <div className="space-y-1.5">
            <Label htmlFor="binding-label">Label (optional)</Label>
            <Input
              id="binding-label"
              placeholder="e.g., Customer support bot"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <ResponsiveDialogFooter className="border-t px-4 py-3">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {isEdit ? 'Save Changes' : 'Create Binding'}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
