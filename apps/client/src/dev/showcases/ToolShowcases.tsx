import { ToolCallCard } from '@/layers/features/chat/ui/ToolCallCard';
import { ToolApproval } from '@/layers/features/chat/ui/ToolApproval';
import { SubagentBlock } from '@/layers/features/chat/ui/SubagentBlock';
import { PlaygroundSection } from '../PlaygroundSection';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { ShowcaseDemo } from '../ShowcaseDemo';
import { MOCK_SESSION_ID, TOOL_CALLS, TOOL_CALL_APPROVAL, SUBAGENT_PARTS } from '../mock-chat-data';

/** Tool-related component showcases: ToolCallCard, ToolApproval. */
export function ToolShowcases() {
  return (
    <>
      <PlaygroundSection
        title="ToolCallCard"
        description="Tool call cards in all four statuses, collapsed and expanded."
      >
        <ShowcaseDemo>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.entries(TOOL_CALLS) as [string, (typeof TOOL_CALLS)[string]][]).map(
              ([key, tc]) => (
                <div key={key}>
                  <ShowcaseLabel>{key}</ShowcaseLabel>
                  <ToolCallCard toolCall={tc} />
                </div>
              )
            )}
          </div>
        </ShowcaseDemo>

        <ShowcaseLabel>Expanded by default</ShowcaseLabel>
        <ShowcaseDemo>
          <ToolCallCard toolCall={TOOL_CALLS.complete} defaultExpanded />
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="SubagentBlock"
        description="Inline subagent lifecycle blocks in all three statuses."
      >
        <ShowcaseDemo>
          <div className="space-y-2">
            {(Object.entries(SUBAGENT_PARTS) as [string, (typeof SUBAGENT_PARTS)[string]][]).map(
              ([key, part]) => (
                <div key={key}>
                  <ShowcaseLabel>{key}</ShowcaseLabel>
                  <SubagentBlock part={part} />
                </div>
              )
            )}
          </div>
        </ShowcaseDemo>
      </PlaygroundSection>

      <PlaygroundSection
        title="ToolApproval"
        description="Approval card for pending tool calls. Uses Transport (mock) for approve/deny."
      >
        <ShowcaseLabel>Inactive</ShowcaseLabel>
        <ShowcaseDemo>
          <ToolApproval
            sessionId={MOCK_SESSION_ID}
            toolCallId={TOOL_CALL_APPROVAL.toolCallId}
            toolName={TOOL_CALL_APPROVAL.toolName}
            input={TOOL_CALL_APPROVAL.input}
          />
        </ShowcaseDemo>

        <ShowcaseLabel>Active (keyboard shortcut target)</ShowcaseLabel>
        <ShowcaseDemo>
          <ToolApproval
            sessionId={MOCK_SESSION_ID}
            toolCallId={TOOL_CALL_APPROVAL.toolCallId + '-active'}
            toolName={TOOL_CALL_APPROVAL.toolName}
            input={TOOL_CALL_APPROVAL.input}
            isActive
          />
        </ShowcaseDemo>
      </PlaygroundSection>
    </>
  );
}
