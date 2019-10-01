import { IToken } from "chevrotain";

/**
 * Returns the location of a token
 *
 * @param token
 */
export const getLocation = (
  token: Pick<IToken, "startColumn" | "endColumn" | "startLine" | "endLine">
) => {
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
