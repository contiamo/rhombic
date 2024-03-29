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
      expected: ["SELECT => Select", "column1 => Identifier", "FROM => From", "table2 => Identifier"]
    },
    {
      title: "identifier with an underscore",
      sql: "SELECT column_1 FROM table2",
      expected: ["SELECT => Select", "column_1 => Identifier", "FROM => From", "table2 => Identifier"]
    },
    {
      title: "a statement with strange case",
      sql: "sEleCT      column1        from          table2",
      expected: ["sEleCT => Select", "column1 => Identifier", "from => From", "table2 => Identifier"]
    },
    {
      title: "escaped identifier",
      sql: `SELECT "column 1" FROM table2`,
      expected: ["SELECT => Select", '"column 1" => Identifier', "FROM => From", "table2 => Identifier"]
    },
    {
      title: "escaped identifier with exotics chars",
      sql: `SELECT "column' 1$&@" FROM table2`,
      expected: ["SELECT => Select", '"column\' 1$&@" => Identifier', "FROM => From", "table2 => Identifier"]
    },
    {
      title: "escaped identifier with a reserved word inside",
      sql: `SELECT "select" FROM table2`,
      expected: ["SELECT => Select", '"select" => Identifier', "FROM => From", "table2 => Identifier"]
    },
    {
      title: "identifier with dot",
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
        "> => BinaryOperator",
        "42 => IntegerValue"
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
        "<= => BinaryOperator",
        "30 => IntegerValue",
        "AND => And",
        "b => Identifier",
        ">= => BinaryOperator",
        "10 => IntegerValue",
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
    },
    {
      title: "string",
      sql: `VALUES '1', '2', '3'`,
      expected: [
        "VALUES => Values",
        "'1' => StringValue",
        ", => Comma",
        "'2' => StringValue",
        ", => Comma",
        "'3' => StringValue"
      ]
    },
    {
      title: "cast",
      sql: "CAST(column1 AS INT)",
      expected: [
        "CAST => Cast",
        "( => LParen",
        "column1 => Identifier",
        "AS => As",
        "INT => SqlTypeName",
        ") => RParen"
      ]
    },
    {
      title: "sql type name",
      sql: "TIMESTAMP DATE CHAR VARYING CHAR CHARACTER DECIMAL INT INTEGER BINARY VARYING",
      expected: [
        "TIMESTAMP => SqlTypeName",
        "DATE => SqlTypeName",
        "CHAR VARYING => SqlTypeName",
        "CHAR => SqlTypeName",
        "CHARACTER => SqlTypeName",
        "DECIMAL => SqlTypeName",
        "INT => SqlTypeName",
        "INTEGER => SqlTypeName",
        "BINARY VARYING => SqlTypeName"
      ]
    },
    {
      title: "cast with precision",
      sql: "CAST(column1 AS DEC(2))",
      expected: [
        "CAST => Cast",
        "( => LParen",
        "column1 => Identifier",
        "AS => As",
        "DEC => SqlTypeName",
        "( => LParen",
        "2 => IntegerValue",
        ") => RParen",
        ") => RParen"
      ]
    },
    {
      title: "cast with precision and scale",
      sql: "CAST(column1 AS DEC(2, 2))",
      expected: [
        "CAST => Cast",
        "( => LParen",
        "column1 => Identifier",
        "AS => As",
        "DEC => SqlTypeName",
        "( => LParen",
        "2 => IntegerValue",
        ", => Comma",
        "2 => IntegerValue",
        ") => RParen",
        ") => RParen"
      ]
    },
    {
      title: "order by asc",
      sql: "ORDER BY column1 ASC NULLS FIRST",
      expected: ["ORDER BY => OrderBy", "column1 => Identifier", "ASC => Asc", "NULLS => Nulls", "FIRST => First"]
    },
    {
      title: "order by desc",
      sql: "ORDER BY column1 DESC NULLS LAST",
      expected: ["ORDER BY => OrderBy", "column1 => Identifier", "DESC => Desc", "NULLS => Nulls", "LAST => Last"]
    },
    {
      title: "limit",
      sql: "LIMIT 10",
      expected: ["LIMIT => Limit", "10 => IntegerValue"]
    },
    {
      title: "binary operators",
      sql: "= > >= < <= != like",
      expected: [
        "= => BinaryOperator",
        "> => BinaryOperator",
        ">= => BinaryOperator",
        "< => BinaryOperator",
        "<= => BinaryOperator",
        "!= => BinaryOperator",
        "like => BinaryOperator"
      ]
    },
    {
      title: "multival operators",
      sql: "in not in",
      expected: ["in => MultivalOperator", "not in => MultivalOperator"]
    },
    {
      title: "unary operators",
      sql: "is null IS NOT NULL",
      expected: ["is null => IsNull", "IS NOT NULL => IsNotNull"]
    },
    {
      title: "boolean",
      sql: "true false",
      expected: ["true => BooleanValue", "false => BooleanValue"]
    },
    {
      title: "date",
      sql: "date '2019-02-01'",
      expected: ["date '2019-02-01' => DateValue"]
    },
    {
      title: "join keywords",
      sql: "NATURAL LEFT RIGHT FULL OUTER JOIN CROSS APPLY INNER",
      expected: [
        "NATURAL => Natural",
        "LEFT => Left",
        "RIGHT => Right",
        "FULL => Full",
        "OUTER => Outer",
        "JOIN => Join",
        "CROSS => Cross",
        "APPLY => Apply",
        "INNER => Inner"
      ]
    },
    {
      title: "concat",
      sql: "SELECT concat(first_name, ' ', last_name) as full_name FROM employee",
      expected: [
        "SELECT => Select",
        "concat => FunctionIdentifier",
        "( => LParen",
        "first_name => Identifier",
        ", => Comma",
        "' ' => StringValue",
        ", => Comma",
        "last_name => Identifier",
        ") => RParen",
        "as => As",
        "full_name => Identifier",
        "FROM => From",
        "employee => Identifier"
      ]
    },
    {
      title: "group by",
      sql: "SELECT COUNT(created_at), role FROM manager_collection_query_connections GROUP BY role",
      expected: [
        "SELECT => Select",
        "COUNT => FunctionIdentifier",
        "( => LParen",
        "created_at => Identifier",
        ") => RParen",
        ", => Comma",
        "role => Identifier",
        "FROM => From",
        "manager_collection_query_connections => Identifier",
        "GROUP => Group",
        "BY => By",
        "role => Identifier"
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
