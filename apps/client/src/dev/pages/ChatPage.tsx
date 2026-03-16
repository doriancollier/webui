import { MessageShowcases } from '../showcases/MessageShowcases';
import { ToolShowcases } from '../showcases/ToolShowcases';
import { InputShowcases } from '../showcases/InputShowcases';
import { StatusShowcases } from '../showcases/StatusShowcases';
import { MiscShowcases } from '../showcases/MiscShowcases';
import { TocSidebar } from '../TocSidebar';
import { CHAT_SECTIONS } from '../playground-registry';

/** Chat component showcase page for the dev playground. */
export function ChatPage() {
  return (
    <>
      <header className="border-border border-b px-6 py-4">
        <h1 className="text-xl font-bold">Chat Components</h1>
        <p className="text-muted-foreground text-sm">
          Visual testing gallery for chat UI components.
        </p>
      </header>

      <div className="flex gap-8 p-6">
        <main className="min-w-0 flex-1 space-y-8">
          <MessageShowcases />
          <ToolShowcases />
          <InputShowcases />
          <StatusShowcases />
          <MiscShowcases />
        </main>
        <TocSidebar sections={CHAT_SECTIONS} />
      </div>
    </>
  );
}
