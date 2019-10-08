import { CstChildrenDictionary } from "chevrotain";
import { isCstNode } from "./isCstNode";

export interface Range {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export const getChildrenRange = (
  children: CstChildrenDictionary,
  range: Range = {
    startLine: Infinity,
    endLine: -Infinity,
    startColumn: Infinity,
    endColumn: -Infinity,
  },
): Range =>
  Object.values(children).reduce(
    (_, tokens) =>
      tokens.reduce((_, token) => {
        if (isCstNode(token)) {
          return getChildrenRange(token.children, range);
        } else {
          return {
            startLine: Math.min(range.startLine, token.startLine || Infinity),
            endLine: Math.max(range.endLine, token.endLine || -Infinity),
            startColumn: Math.min(range.startColumn, token.startColumn || Infinity),
            endColumn: Math.max(range.endColumn, token.endColumn || -Infinity),
          };
        }
      }, range),
    range,
  );
