import { CstChildrenDictionary } from "chevrotain";
import { isCstNode } from "./isCstNode";

export interface Range {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

const extractRange = (children: CstChildrenDictionary, range: Range): any =>
  Object.values(children).reduce(
    (_, tokens) =>
      tokens.reduce((_, token) => {
        if (isCstNode(token)) {
          return extractRange(token.children, range);
        } else {
          return {
            startLine: Math.min(range.startLine, token.startLine || Infinity),
            endLine: Math.max(range.endLine, token.endLine || -Infinity),
            startColumn: Math.min(range.startColumn, token.startColumn || Infinity),
            endColumn: Math.max(range.endColumn, token.endColumn || -Infinity),
          };
        }
      }, {}),
    {},
  );

/**
 * Extract the range for a children dictionnary.
 *
 * @param children
 */
export const getChildrenRange = (children: CstChildrenDictionary): Range => {
  const range: Range = {
    startLine: Infinity,
    endLine: -Infinity,
    startColumn: Infinity,
    endColumn: -Infinity,
  };

  return extractRange(children, range);
};
