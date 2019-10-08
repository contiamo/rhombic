import { CstChildrenDictionary } from "chevrotain";
import { isCstNode } from "./isCstNode";

export interface Range {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

const extractRange = (children: CstChildrenDictionary, range: Range) => {
  Object.values(children).forEach(tokens => {
    if (!Array.isArray(tokens)) return;
    tokens.forEach(token => {
      if (isCstNode(token)) {
        extractRange(token.children, range);
        return;
      } else {
        range.startLine = Math.min(
          range.startLine,
          token.startLine || Infinity
        );
        range.endLine = Math.max(range.endLine, token.endLine || -Infinity);
        range.startColumn = Math.min(
          range.startColumn,
          token.startColumn || Infinity
        );
        range.endColumn = Math.max(
          range.endColumn,
          token.endColumn || -Infinity
        );
      }
    });
  });
};

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
    endColumn: -Infinity
  };
  extractRange(children, range); // This mutate `range` directly

  return range;
};
