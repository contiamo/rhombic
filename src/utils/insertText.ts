/**
 * Insert a piece of text a multiline sql statement.
 *
 * @param sql initial sql
 * @param input text to insert
 * @param location
 */
export const insertText = (
  sql: string,
  input: string,
  location: { line: number; column: number }
) => {
  const lines = sql.split("\n");
  if (location.line > lines.length) {
    throw new Error(
      `Can't insert a text on line ${location.line}, the sql statement has only ${lines.length} lines`
    );
  }

  if (location.column > lines[location.line].length) {
    throw new Error(
      `Can't insert a text at ${location.line}:${location.column}, the line has only ${lines[location.line].length} characts`
    );
  }

  lines[location.line] =
    lines[location.line].slice(0, location.column) +
    input +
    lines[location.line].slice(location.column);

  return lines.join("\n");
};
