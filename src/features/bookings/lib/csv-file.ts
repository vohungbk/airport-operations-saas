/** CO-F07-S01: what the import screen accepts from the file picker and from a drop. */
export const CSV_FILE_ACCEPT = ".csv,text/csv";

/** A file counts as a CSV by its name; the type a browser reports for a CSV is not reliable. */
export function isCsvFile(file: Pick<File, "name">): boolean {
  return file.name.toLowerCase().endsWith(".csv");
}

/** `28.4 KB`, `1.2 MB`: the size of a file as the design shows it. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
