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
    },
    {
      title: "SELECT without FROM",
      sql: "SELECT 'hello'",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(String("'hello'"))
            )
          )
        )
      )`
    },
    {
      title: "simple SELECT * statement",
      sql: "SELECT * FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              Asterisk("*")
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_db")
              )
            )
          )
        )
      )`
    },
    {
      title: "simple SELECT * statement (complex table name)",
      sql: "SELECT * FROM my_catalog.my_schema.my_table",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              Asterisk("*")
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_catalog", "my_schema", "my_table")
                Period(".", ".")
              )
            )
          )
        )
      )`
    },
    {
      title: "SELECT one column statement",
      sql: "SELECT column01 FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(
                Identifier("column01")
              )
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_db")
              )
            )
          )
        )
      )`
    },
    {
      title: "SELECT multiple columns statement",
      sql: "SELECT column01, column02, column03 FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(
                Identifier("column01")
              )
            )
            projectionItem(
              expression(
                Identifier("column02")
              )
            )
            projectionItem(
              expression(
                Identifier("column03")
              )
            )
            Comma(",", ",")
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_db")
              )
            )
          )
        )
      )`
    },
    {
      title: "SELECT ALL",
      sql: "SELECT ALL column01 FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          All("ALL")
          projectionItems(
            projectionItem(
              expression(
                Identifier("column01")
              )
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_db")
              )
            )
          )
        )
      )`
    },
    {
      title: "SELECT DISTINCT",
      sql: "SELECT DISTINCT column01 FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          Distinct("DISTINCT")
          projectionItems(
            projectionItem(
              expression(
                Identifier("column01")
              )
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("my_db")
              )
            )
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
        const previous = require("fs").readFileSync("debug.json", "utf-8");
        const next = JSON.stringify(result.cst, null, 2);
        if (previous !== next) {
          require("fs").writeFileSync("debug.json", next);
        }
      }

      expect(prettifyCst(result.cst.children)).toEqual(
        expectedCst.replace(/[\s\t\n]/g, "")
      );
    });
  });
});
