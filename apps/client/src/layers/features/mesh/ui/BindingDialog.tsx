import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Badge,
} from '@/layers/shared/ui';
import { useAdapterCatalog, useObservedChats } from '@/layers/entities/relay';
import { useRegisteredAgents } from '@/layers/entities/mesh';
import { cn } from '@/layers/shared/lib';
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
    description: 'One session per user. All messages from a user share a session across chats.',
  },
  {
    value: 'stateless',
    label: 'Stateless',
    description: 'Every message starts a new session. No conversation history.',
  },
];

const CHANNEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'dm', label: 'Direct Message' },
  { value: 'group', label: 'Group' },
  { value: 'channel', label: 'Channel' },
  { value: 'thread', label: 'Thread' },
];

/**
 * Sentinel value used for Radix Select "any / no filter" option.
 * Radix forbids empty-string values on SelectItem, so we use this
 * sentinel and convert back to undefined before submitting.
 */
const SELECT_ANY = '__any__';

/** Values submitted when the user confirms the dialog. */
export interface BindingFormValues {
  adapterId: string;
  agentId: string;
  projectPath: string;
  sessionStrategy: SessionStrategy;
  label: string;
  chatId?: string;
  channelType?: 'dm' | 'group' | 'channel' | 'thread';
}

export interface BindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the user's configuration when the confirm button is clicked. */
  onConfirm: (values: BindingFormValues) => void;
  mode?: 'create' | 'edit';
  /** Pre-populate fields. In edit mode, adapter and agent are read-only display values. */
  initialValues?: Partial<BindingFormValues>;
  /** In edit mode, human-readable name of the source adapter (read-only). */
  adapterName?: string;
  /** In edit mode, human-readable name of the target agent (read-only). */
  agentName?: string;
}

/**
 * Modal dialog for configuring or editing an adapter-agent binding.
 *
 * In create mode, shows adapter picker, agent picker, project path, session
 * strategy, label, and a collapsible chat filter section (chatId + channelType).
 * In edit mode, adapter and agent are read-only and all other fields are editable.
 */
export function BindingDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  initialValues,
  adapterName,
  agentName,
}: BindingDialogProps) {
  const isEdit = mode === 'edit';

  const [adapterId, setAdapterId] = useState(initialValues?.adapterId ?? '');
  const [agentId, setAgentId] = useState(initialValues?.agentId ?? '');
  const [projectPath, setProjectPath] = useState(initialValues?.projectPath ?? '');
  const [strategy, setStrategy] = useState<SessionStrategy>(
    initialValues?.sessionStrategy ?? 'per-chat',
  );
  const [label, setLabel] = useState(initialValues?.label ?? '');
  // Use SELECT_ANY as the internal "no filter" value; empty string is forbidden by Radix Select.
  const [chatId, setChatId] = useState(initialValues?.chatId ?? SELECT_ANY);
  const [channelType, setChannelType] = useState(initialValues?.channelType ?? SELECT_ANY);
  // Auto-open chat filter section when initial values already have a filter set.
  const [chatFilterOpen, setChatFilterOpen] = useState(
    !!(initialValues?.chatId || initialValues?.channelType),
  );

  // Sync all state when initialValues change (e.g. opening a different binding to edit)
  useEffect(() => {
    if (initialValues) {
      setAdapterId(initialValues.adapterId ?? '');
      setAgentId(initialValues.agentId ?? '');
      setProjectPath(initialValues.projectPath ?? '');
      setStrategy(initialValues.sessionStrategy ?? 'per-chat');
      setLabel(initialValues.label ?? '');
      setChatId(initialValues.chatId ?? SELECT_ANY);
      setChannelType(initialValues.channelType ?? SELECT_ANY);
      if (initialValues.chatId || initialValues.channelType) {
        setChatFilterOpen(true);
      }
    }
  }, [initialValues]);

  const { data: catalog = [] } = useAdapterCatalog();
  const { data: agentsData } = useRegisteredAgents();
  const { data: observedChats = [] } = useObservedChats(adapterId || undefined);

  // Flatten enabled adapter instances from the catalog for the picker
  const adapterOptions = catalog.flatMap((entry) =>
    entry.instances
      .filter((inst) => inst.enabled)
      .map((inst) => ({
        id: inst.id,
        label: inst.label ? `${inst.label} (${entry.manifest.displayName})` : `${inst.id} (${entry.manifest.displayName})`,
      })),
  );

  const agentOptions = agentsData?.agents ?? [];

  const selectedStrategy = SESSION_STRATEGIES.find((s) => s.value === strategy);
  // SELECT_ANY means "no filter selected" — convert back to undefined before submitting.
  const hasChatFilter = chatId !== SELECT_ANY || channelType !== SELECT_ANY;

  function handleAgentChange(selectedId: string) {
    setAgentId(selectedId);
  }

  function handleConfirm() {
    onConfirm({
      adapterId,
      agentId,
      projectPath,
      sessionStrategy: strategy,
      label,
      chatId: chatId === SELECT_ANY ? undefined : chatId,
      channelType:
        channelType === SELECT_ANY
          ? undefined
          : (channelType as BindingFormValues['channelType']),
    });
    if (!isEdit) {
      resetForm();
    }
  }

  function resetForm() {
    setAdapterId('');
    setAgentId('');
    setProjectPath('');
    setStrategy('per-chat');
    setLabel('');
    setChatId(SELECT_ANY);
    setChannelType(SELECT_ANY);
    setChatFilterOpen(false);
  }

  function handleCancel() {
    onOpenChange(false);
  }

  function handleClearFilters() {
    setChatId(SELECT_ANY);
    setChannelType(SELECT_ANY);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] max-w-md gap-0 p-0">
        <ResponsiveDialogHeader className="border-b px-4 py-3">
          <ResponsiveDialogTitle>{isEdit ? 'Edit Binding' : 'Create Binding'}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {isEdit
              ? 'Modify the binding configuration'
              : 'Configure how the adapter connects to the agent'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-5 overflow-y-auto px-4 py-5">
          {isEdit ? (
            /* Edit mode: adapter and agent are read-only */
            <p className="text-sm text-muted-foreground">
              Binding:{' '}
              <span className="font-medium text-foreground">{adapterName}</span>
              {' '}to{' '}
              <span className="font-medium text-foreground">{agentName}</span>
            </p>
          ) : (
            /* Create mode: adapter and agent pickers */
            <>
              <div className="space-y-1.5">
                <Label htmlFor="binding-adapter">Adapter</Label>
                <Select value={adapterId} onValueChange={setAdapterId}>
                  <SelectTrigger id="binding-adapter" className="w-full">
                    <SelectValue placeholder="Select an adapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {adapterOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="binding-agent">Agent</Label>
                <Select value={agentId} onValueChange={handleAgentChange}>
                  <SelectTrigger id="binding-agent" className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="binding-project-path">Project Path</Label>
                <Input
                  id="binding-project-path"
                  placeholder="/home/user/project"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                />
              </div>
            </>
          )}

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

          {/* Chat filter — collapsible */}
          <Collapsible open={chatFilterOpen} onOpenChange={setChatFilterOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform',
                  chatFilterOpen && 'rotate-90',
                )}
              />
              Chat Filter
              {hasChatFilter && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* ChatId picker */}
              <div className="space-y-1.5">
                <Label htmlFor="binding-chat-id">Chat ID</Label>
                <Select value={chatId} onValueChange={setChatId}>
                  <SelectTrigger id="binding-chat-id" className="w-full">
                    <SelectValue placeholder="Any chat (wildcard)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_ANY}>Any chat (wildcard)</SelectItem>
                    {observedChats.map((chat) => (
                      <SelectItem key={chat.chatId} value={chat.chatId}>
                        <span>{chat.displayName ?? chat.chatId}</span>
                        {(chat.channelType || chat.messageCount > 0) && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {[chat.channelType, `${chat.messageCount} msgs`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ChannelType picker */}
              <div className="space-y-1.5">
                <Label htmlFor="binding-channel-type">Channel Type</Label>
                <Select value={channelType} onValueChange={setChannelType}>
                  <SelectTrigger id="binding-channel-type" className="w-full">
                    <SelectValue placeholder="Any type (wildcard)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_ANY}>Any type (wildcard)</SelectItem>
                    {CHANNEL_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasChatFilter && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
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
