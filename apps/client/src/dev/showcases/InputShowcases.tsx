import { useState } from 'react';
import { ChatInput } from '@/layers/features/chat/ui/ChatInput';
import { FileChipBar } from '@/layers/features/chat/ui/FileChipBar';
import { QueuePanel } from '@/layers/features/chat/ui/QueuePanel';
import { ShortcutChips } from '@/layers/features/chat/ui/ShortcutChips';
import { PromptSuggestionChips } from '@/layers/features/chat/ui/PromptSuggestionChips';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { SAMPLE_FILES, SAMPLE_QUEUE } from '../mock-chat-data';

function ChatInputDemo({
  label,
  initialValue = '',
  isStreaming = false,
  queueDepth = 0,
}: {
  label: string;
  initialValue?: string;
  isStreaming?: boolean;
  queueDepth?: number;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div>
      <ShowcaseLabel>{label}</ShowcaseLabel>
      <ShowcaseDemo>
        <div className="border-border rounded-xl border">
          <ChatInput
            value={value}
            onChange={setValue}
            onSubmit={() => {}}
            isStreaming={isStreaming}
            queueDepth={queueDepth}
            onStop={() => {}}
            onQueue={() => {}}
          />
        </div>
      </ShowcaseDemo>
    </div>
  );
}

/** Input-related component showcases: ChatInput, FileChipBar, QueuePanel, ShortcutChips, PromptSuggestionChips. */
export function InputShowcases() {
  const [files, setFiles] = useState(SAMPLE_FILES);

  return (
    <>
      <PlaygroundSection
        title="ChatInput"
        description="Chat text input in different states."
      >
        <ChatInputDemo label="Idle" />
        <ChatInputDemo
          label="With text"
          initialValue="Can you help me refactor the auth module?"
        />
        <ChatInputDemo label="Streaming (stop button)" isStreaming />
        <ChatInputDemo
          label="Streaming with queue"
          isStreaming
          queueDepth={2}
        />
      </PlaygroundSection>

      <PlaygroundSection
        title="FileChipBar"
        description="File chips in various upload states."
      >
        <ShowcaseDemo>
          <FileChipBar
            files={files}
            onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          />
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="QueuePanel"
        description="Queued messages displayed above the input."
      >
        <ShowcaseLabel>With items</ShowcaseLabel>
        <ShowcaseDemo>
          <QueuePanel
            queue={SAMPLE_QUEUE}
            editingIndex={null}
            onEdit={() => {}}
            onRemove={() => {}}
          />
        </ShowcaseDemo>

        <ShowcaseLabel>With item being edited</ShowcaseLabel>
        <ShowcaseDemo>
          <QueuePanel
            queue={SAMPLE_QUEUE}
            editingIndex={1}
            onEdit={() => {}}
            onRemove={() => {}}
          />
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="ShortcutChips"
        description="Quick-access chips for / commands and @ file mentions."
      >
        <ShowcaseDemo>
          <ShortcutChips onChipClick={() => {}} />
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="PromptSuggestionChips"
        description="SDK-provided follow-up suggestions shown after assistant responses."
      >
        <ShowcaseLabel>With suggestions</ShowcaseLabel>
        <ShowcaseDemo>
          <PromptSuggestionChips
            suggestions={[
              'Run the tests',
              'Review the changes',
              'Commit this work',
            ]}
            onChipClick={() => {}}
          />
        </ShowcaseDemo>

        <ShowcaseLabel>Long suggestions (truncated)</ShowcaseLabel>
        <ShowcaseDemo>
          <PromptSuggestionChips
            suggestions={[
              'Can you refactor the authentication module to use JWT tokens instead?',
              'Show me the test coverage report for the shared package',
              'Deploy to staging',
              'Fix the TypeScript errors in the relay package',
            ]}
            onChipClick={() => {}}
          />
        </ShowcaseDemo>

        <ShowcaseLabel>Single suggestion</ShowcaseLabel>
        <ShowcaseDemo>
          <PromptSuggestionChips
            suggestions={['Run the tests']}
            onChipClick={() => {}}
          />
        </ShowcaseDemo>
      </PlaygroundSection>
    </>
  );
}
