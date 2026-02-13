import { Streamdown } from 'streamdown';
import { cn } from '../../lib/utils';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming = false }: StreamingTextProps) {
  return (
    <div className={cn('relative', isStreaming && 'streaming-cursor')}>
      <Streamdown shikiTheme={['github-light', 'github-dark']}>
        {content}
      </Streamdown>
    </div>
  );
}
