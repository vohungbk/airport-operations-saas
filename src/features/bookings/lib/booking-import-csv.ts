/**
 * CO-F07-S03: reads CSV text into rows of cells. A cell may be in double quotes, so it can hold a
 * comma, a line break or a quote written twice. Lines end with LF or CRLF. A line with nothing in it
 * is dropped. There is no dependency for this: the import needs nothing more.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") endField();
    else if (char === "\n") endRow();
    else if (char === "\r") {
      if (text[index + 1] === "\n") index++;
      endRow();
    } else field += char;
  }
  if (field !== "" || row.length > 0) endRow();

  return rows.filter((cells) => !(cells.length === 1 && cells[0].trim() === ""));
}
