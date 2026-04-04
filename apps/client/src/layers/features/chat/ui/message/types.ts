import type { ToolApprovalHandle } from '../tools/ToolApproval';
import type { QuestionPromptHandle } from '../tools/QuestionPrompt';

export type InteractiveToolHandle = ToolApprovalHandle | QuestionPromptHandle;
