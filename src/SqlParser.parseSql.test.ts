import { parseSql } from "./SqlParser";
import {
  ILexingError,
  IRecognitionException,
  CstNode,
  CstChildrenDictionary
} from "chevrotain";

const isCstNode = (node: any): node is CstNode => !!node.name;

/**
 * Pretty output for cst for easy specifications
 *
 * @param cst
 */
function prettifyCst(cst: CstChildrenDictionary) {
  let output = "";
  Object.entries(cst).forEach(([key, elements]) => {
    output += key;
    elements.forEach((node, i, nodes) => {
      if (isCstNode(node)) {
        output += "(" + prettifyCst(node.children) + ")";
      } else {
        if (i === 0) output += "(";
        output += `"${node.image}"`;
        if (i === nodes.length - 1) output += ")";
        else output += ",";
      }
    });
  });
  return output;
}

describe("parseSql", () => {
  const cases: Array<{
    title: string;
    sql: string;
    expected:
      | {
          lexErrors?: ILexingError[];
          parseError?: IRecognitionException[];
          cst: string;
        }
      | string;
    only?: boolean;
  }> = [
    {
      title: "a VALUES statement (numbers)",
      sql: "VALUES 2, 3",
      expected: `query ( values( Values("VALUES") Integer("2","3") Comma(",") ) )`
    }
    // {
    //   title: "a VALUES statement (string)",
    //   sql: "VALUES 'a', 'b'",
    //   expected: `query ( values( Values("VALUES") Expression("'2'","'3'") Comma(",") ) )`
    // }
  ];

  cases.forEach(({ sql, only, title, expected }) => {
    (only ? it.only : it)(`should parse ${title}`, () => {
      const result = parseSql(sql);
      // Error assertions
      const expectedLexErrors =
        typeof expected === "string" ? [] : expected.lexErrors || [];
      const expectedParseErrors =
        typeof expected === "string" ? [] : expected.parseError || [];

      expect(result.lexErrors).toEqual(expectedLexErrors);
      expect(result.parseErrors).toEqual(expectedParseErrors);

      // Result assertion
      const expectedCst =
        typeof expected === "string" ? expected : expected.cst;

      expect(prettifyCst(result.cst.children)).toEqual(
        expectedCst.replace(/ /g, "")
      );
    });
  });
});
