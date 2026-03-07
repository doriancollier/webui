/**
 * Session services — transcript reading/parsing, session broadcasting,
 * locking, and task state management.
 *
 * @module services/session
 */
export { TASK_TOOL_NAMES, buildTaskEvent } from '../runtimes/claude-code/build-task-event.js';
export { SessionBroadcaster } from '../runtimes/claude-code/session-broadcaster.js';
export { SessionLockManager } from '../runtimes/claude-code/session-lock.js';
export { parseTasks } from '../runtimes/claude-code/task-reader.js';
export {
  extractToolResultContent,
  extractTextContent,
  extractCommandMeta,
  stripSystemTags,
  mapSdkAnswersToIndices,
  parseQuestionAnswers,
  parseTranscript,
} from '../runtimes/claude-code/transcript-parser.js';
export type { TranscriptLine, ContentBlock } from '../runtimes/claude-code/transcript-parser.js';
export { TranscriptReader } from '../runtimes/claude-code/transcript-reader.js';
export type { HistoryMessage, HistoryToolCall } from '../runtimes/claude-code/transcript-reader.js';
