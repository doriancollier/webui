/** A file or directory entry for autocomplete and file browser UIs. */
export interface FileEntry {
  path: string;
  filename: string;
  directory: string;
  isDirectory: boolean;
}
