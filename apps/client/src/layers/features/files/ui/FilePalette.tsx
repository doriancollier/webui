import { useEffect } from 'react';
import { motion } from 'motion/react';
import { File, Folder } from 'lucide-react';
import type { FileEntry } from '@/layers/shared/lib';

interface FilePaletteProps {
  filteredFiles: Array<FileEntry & { indices: number[] }>;
  selectedIndex: number;
  onSelect: (entry: FileEntry) => void;
}

function HighlightedText({
  text,
  indices,
  startOffset = 0,
}: {
  text: string;
  indices: number[];
  startOffset?: number;
}) {
  const highlightSet = new Set(indices.map((i) => i - startOffset));
  return (
    <>
      {text.split('').map((char, i) =>
        highlightSet.has(i) ? (
          <span key={i} className="text-foreground font-semibold">
            {char}
          </span>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
    </>
  );
}

/** Dropdown list of files with keyboard navigation and fuzzy-match highlighting. */
export function FilePalette({ filteredFiles, selectedIndex, onSelect }: FilePaletteProps) {
  useEffect(() => {
    const activeEl = document.getElementById(`file-item-${selectedIndex}`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 4 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      className="bg-popover max-h-80 overflow-hidden rounded-lg border shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div id="file-palette-listbox" role="listbox" className="max-h-72 overflow-y-auto p-1.5">
        {filteredFiles.length === 0 ? (
          <div className="text-muted-foreground px-2 py-4 text-center text-sm">No files found.</div>
        ) : (
          filteredFiles.map((entry, index) => {
            const isSelected = index === selectedIndex;
            const Icon = entry.isDirectory ? Folder : File;
            return (
              <div
                key={entry.path}
                id={`file-item-${index}`}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(entry)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(entry);
                }}
                className="data-[selected=true]:bg-accent hover:bg-muted flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-100"
              >
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground truncate text-sm font-medium">
                    <HighlightedText
                      text={entry.filename}
                      indices={entry.indices}
                      startOffset={entry.directory.length}
                    />
                  </span>
                  {entry.directory && (
                    <p className="text-muted-foreground/70 truncate text-xs leading-normal">
                      {entry.directory}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
