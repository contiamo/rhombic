import { IToken } from "chevrotain";

type Token = Pick<
  IToken,
  "startColumn" | "endColumn" | "startLine" | "endLine"
>;

export interface Location {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Returns the location of a token
 *
 * @param tokens
 */
export const getLocation = (tokens: Token | Token[]): Location => {
  if (Array.isArray(tokens)) {
    const startLocation = getLocation(tokens[0]);
    const endLocation = getLocation(tokens[tokens.length - 1]);

    return {
      startLine: startLocation.startLine,
      startColumn: startLocation.startColumn,
      endLine: endLocation.endLine,
      endColumn: endLocation.endColumn
    };
  }

  const token = tokens; // Just rename for semantic

  if (
    token.startLine === undefined ||
    token.endLine === undefined ||
    token.startColumn === undefined ||
    token.endColumn === undefined
  ) {
    throw new Error("Token is missing location information");
  }

  return {
    startLine: token.startLine!, // Checked in the runtime
    endLine: token.endLine!, // Checked in the runtime
    startColumn: token.startColumn!, // Checked in the runtime
    endColumn: token.endColumn! // Checked in the runtime
  };
};
