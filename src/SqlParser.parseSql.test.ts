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
  Object.entries(cst).forEach(([_, elements]) => {
    elements.forEach((node, i, nodes) => {
      if (isCstNode(node)) {
        output += node.name + "(" + prettifyCst(node.children) + ")";
      } else {
        if (i === 0 && node.tokenType) output += node.tokenType.tokenName;
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
    debug?: boolean; // export in debug.json
  }> = [
    {
      title: "a VALUES statement (numbers)",
      sql: "VALUES 2, 3",
      expected: `query(
        values(
          Values("VALUES")
          expression(Integer("2"))
          expression(Integer("3"))
          Comma(",")
        )
      )`
    },
    {
      title: "a VALUES statement (string)",
      sql: "VALUES 'a', 'b'",
      expected: `query(
        values(
          Values("VALUES")
          expression(String("'a'"))
          expression(String("'b'"))
          Comma(",")
        )
      )`
    },
    {
      title: "a VALUES statement (array)",
      sql: "VALUES ('a', 'b')",
      expected: `query(
        values(
          Values("VALUES")
          expression(
            LParen("(")
            expression(String("'a'"))
            expression(String("'b'"))
            Comma(",")
            RParen(")")
          )
        )
      )`
    }
  ];

  cases.forEach(({ sql, only, title, expected, debug }) => {
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

      // Advanced debug
      if (debug) {
        require("fs").writeFileSync(
          "debug.json",
          JSON.stringify(result.cst, null, 2)
        );
      }

      expect(prettifyCst(result.cst.children)).toEqual(
        expectedCst.replace(/[\s\t\n]/g, "")
      );
    });
  });
});
