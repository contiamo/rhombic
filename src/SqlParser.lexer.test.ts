import { SqlLexer } from "./SqlParser";
import { IToken } from "chevrotain";

/**
 * Return a simple structure of the token to have cleaner tests
 *
 * @param token
 */
function extractTokenName(token: IToken) {
  return `${token.image} => ${token.tokenType && token.tokenType.tokenName}`;
}

describe("Sql Lexer", () => {
  const cases: Array<{
    title: string;
    sql: string;
    expected: string[];
    only?: boolean;
  }> = [
    {
      title: "a simple case",
      sql: "SELECT column1 FROM table2",
      expected: [
        "SELECT => Select",
        "column1 => Identifier",
        "FROM => From",
        "table2 => Identifier"
      ]
    },
    {
      title: "identifier with an underscore",
      sql: "SELECT column_1 FROM table2",
      expected: [
        "SELECT => Select",
        "column_1 => Identifier",
        "FROM => From",
        "table2 => Identifier"
      ]
    },
    {
      title: "a statement with strange case",
      sql: "sEleCT      column1        from          table2",
      expected: [
        "sEleCT => Select",
        "column1 => Identifier",
        "from => From",
        "table2 => Identifier"
      ]
    },
    {
      title: "escaped identifier",
      sql: `SELECT "column 1" FROM table2`,
      expected: [
        "SELECT => Select",
        '"column 1" => Identifier',
        "FROM => From",
        "table2 => Identifier"
      ]
    },
    {
      title: "escaped identifier with a reserved word inside",
      sql: `SELECT "select" FROM table2`,
      expected: [
        "SELECT => Select",
        '"select" => Identifier',
        "FROM => From",
        "table2 => Identifier"
      ]
    },
    {
      title: "period between two identifier",
      sql: `SELECT column1 FROM db.table2`,
      expected: [
        "SELECT => Select",
        "column1 => Identifier",
        "FROM => From",
        "db => Identifier",
        ". => Period",
        "table2 => Identifier"
      ]
    },
    {
      title: "numbers",
      sql: `SELECT column1 FROM db.table2 WHERE column1 > 42`,
      expected: [
        "SELECT => Select",
        "column1 => Identifier",
        "FROM => From",
        "db => Identifier",
        ". => Period",
        "table2 => Identifier",
        "WHERE => Where",
        "column1 => Identifier",
        "> => GreaterThan",
        "42 => Integer"
      ]
    },
    {
      title: "operators",
      sql: `SELECT * FROM table2 WHERE a <= 30 AND b >= 10 OR c IS NULL`,
      expected: [
        "SELECT => Select",
        "* => Asterisk",
        "FROM => From",
        "table2 => Identifier",
        "WHERE => Where",
        "a => Identifier",
        "<= => LessEqualThan",
        "30 => Integer",
        "AND => And",
        "b => Identifier",
        ">= => GreaterEqualThan",
        "10 => Integer",
        "OR => Or",
        "c => Identifier",
        "IS NULL => IsNull"
      ]
    },
    {
      title: "function identifier",
      sql: `SELECT COUNT(column1) FROM table2`,
      expected: [
        "SELECT => Select",
        "COUNT => FunctionIdentifier",
        "( => LParen",
        "column1 => Identifier",
        ") => RParen",
        "FROM => From",
        "table2 => Identifier"
      ]
    }
  ];

  cases.forEach(({ sql, expected, only, title }) => {
    (only ? it.only : it)(`should tokenize ${title}`, () => {
      const result = SqlLexer.tokenize(sql);
      expect(result.errors).toEqual([]);
      expect(result.tokens.map(extractTokenName)).toEqual(expected);
    });
  });
});
