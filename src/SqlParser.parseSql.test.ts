import { parseSql } from "./SqlParser";
import { ILexingError, IRecognitionException } from "chevrotain";
import { prettifyCst, formatCst } from "./utils/prettifyCst";
import fs from "fs";

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
          expression(IntegerValue("2"))
          expression(IntegerValue("3"))
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
          expression(StringValue("'a'"))
          expression(StringValue("'b'"))
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
            expression(StringValue("'a'"))
            expression(StringValue("'b'"))
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
              expression(StringValue("'hello'"))
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
      title: "SELECT with multi-level identifiers",
      sql: "SELECT foo.bar FROM foo.bar",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(
                columnPrimary(
                  Identifier("foo", "bar")
                  Period(".")
                )
              )
            )
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(
                Identifier("foo", "bar")
                Period(".")
              )
            )
          )
        )
      )`
    },
    {
      title: "simple SELECT with LIMIT",
      sql: "SELECT * FROM my_db LIMIT 10",
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
        Limit("LIMIT")
        IntegerValue("10")
      )`
    },
    {
      title: "simple SELECT with LIMIT ALL",
      sql: "SELECT * FROM my_db LIMIT ALL",
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
        Limit("LIMIT")
        All("ALL")
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
                columnPrimary(
                  Identifier("column01")
                )
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
      title: "SELECT with function",
      sql: "SELECT COUNT(column01) FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(
                FunctionIdentifier("COUNT")
                LParen("(")
                expression(
                  columnPrimary(
                    Identifier("column01")
                  )
                )
                RParen(")")
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
      title: "SELECT with cast",
      sql: "SELECT CAST(column01 AS INT) FROM my_db",
      expected: `
      query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              expression(
                cast(
                  Cast("CAST")
                  LParen("(")
                  expression(
                    columnPrimary(
                      Identifier("column01")
                    )
                  )
                  As("AS")
                  type(
                    SqlTypeName("INT")
                  )
                  RParen(")")
                )
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
                columnPrimary(
                  Identifier("column01")
                )
              )
            )
            projectionItem(
              expression(
                columnPrimary(
                  Identifier("column02")
                )
              )
            )
            projectionItem(
              expression(
                columnPrimary(
                  Identifier("column03")
                )
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
                columnPrimary(
                  Identifier("column01")
                )
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
                columnPrimary(
                  Identifier("column01")
                )
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
      title: "ORDER BY ASC",
      sql: "SELECT column1, column2 FROM my_db ORDER BY column1 ASC",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(expression(columnPrimary(Identifier("column1"))))
            projectionItem(expression(columnPrimary(Identifier("column2"))))
            Comma(",")
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db"))))
          )
          orderBy(
            OrderBy("ORDER BY")
            orderItem(
              expression(columnPrimary(Identifier("column1")))
              Asc("ASC")
            )
          )
        )`
    },
    {
      title: "ORDER BY DESC",
      sql: "SELECT column1, column2 FROM my_db ORDER BY column1 DESC",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(expression(columnPrimary(Identifier("column1"))))
            projectionItem(expression(columnPrimary(Identifier("column2"))))
            Comma(",")
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db"))))
          )
          orderBy(
            OrderBy("ORDER BY")
            orderItem(
              expression(columnPrimary(Identifier("column1")))
              Desc("DESC")
            )
          )
        )`
    },
    {
      title: "ORDER BY NULLS FIRST",
      sql:
        "SELECT column1, column2 FROM my_db ORDER BY column1 ASC NULLS FIRST",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(expression(columnPrimary(Identifier("column1"))))
            projectionItem(expression(columnPrimary(Identifier("column2"))))
            Comma(",")
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db"))))
          )
          orderBy(
            OrderBy("ORDER BY")
            orderItem(
              expression(columnPrimary(Identifier("column1")))
              Asc("ASC")
              Nulls("NULLS")
              First("FIRST")
            )
          )
        )`
    },
    {
      title: "ORDER BY NULLS LAST",
      sql: "SELECT column1, column2 FROM my_db ORDER BY column1 ASC NULLS LAST",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(expression(columnPrimary(Identifier("column1"))))
            projectionItem(expression(columnPrimary(Identifier("column2"))))
            Comma(",")
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db"))))
          )
          orderBy(
            OrderBy("ORDER BY")
            orderItem(
              expression(columnPrimary(Identifier("column1")))
              Asc("ASC")
              Nulls("NULLS")
              Last("LAST")
            )
          )
        )`
    },
    {
      title: "ORDER BY multiple",
      sql:
        "SELECT column1, column2 FROM my_db ORDER BY column1 ASC, column2 DESC",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(expression(columnPrimary(Identifier("column1"))))
            projectionItem(expression(columnPrimary(Identifier("column2"))))
            Comma(",")
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db"))))
          )
          orderBy(
            OrderBy("ORDER BY")
            orderItem(
              expression(columnPrimary(Identifier("column1")))
              Asc("ASC")
            )
            orderItem(
              expression(columnPrimary(Identifier("column2")))
              Desc("DESC")
              )
            Comma(",")
          )
        )`
    },
    {
      title: "WHERE",
      sql: "SELECT * FROM my_db WHERE column1 = 'toto'",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              Asterisk("*")
            )
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(Identifier("my_db")))
          )
          where(
            Where("WHERE")
            booleanExpression(
              booleanExpressionValue(
                columnPrimary(
                  Identifier("column1")
                )
                BinaryOperator("=")
                valueExpression(StringValue("'toto'"))
              )
            )
          )
        )
      )`
    },
    {
      title: "WHERE with multivalue",
      sql:
        "SELECT * FROM \"foodmart\".\"CURRENCY\" WHERE CURRENCY in ('USD', 'Mexican Peso')",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(
              Asterisk("*")
            )
          )
          From("FROM")
          tableExpression(
            tableReference(tablePrimary(
              Identifier(""foodmart"", ""CURRENCY"")
              Period(".")
              )
            )
          )
          where(
            Where("WHERE")
            booleanExpression(
              booleanExpressionValue(
                columnPrimary(
                  Identifier("CURRENCY")
                )
                MultivalOperator("in")
                LParen("(")
                valueExpression(StringValue("'USD'"))
                valueExpression(StringValue("'Mexican Peso'"))
                Comma(",")
                RParen(")")
              )
            )
          )
        )
      )`
    },
    {
      title: "WHERE with multiple conditions",
      sql:
        "SELECT * FROM my_db WHERE a in ('USD', 'Mexican Peso') AND (b = 'foo' OR c >= 42)",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(Asterisk("*"))
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(Identifier("my_db"))
            )
          )
          where(
            Where("WHERE")
            booleanExpression(
              booleanExpressionValue(
                columnPrimary(
                  Identifier("a")
                )
                MultivalOperator("in")
                LParen("(")
                valueExpression(StringValue("'USD'"))
                valueExpression(StringValue("'Mexican Peso'"))
                Comma(",")
                RParen(")")
              )
              And("AND")
              booleanExpression(
                LParen("(")
                booleanExpression(
                  booleanExpressionValue(
                    columnPrimary(
                      Identifier("b")
                    )
                    BinaryOperator("=")
                    valueExpression(StringValue("'foo'"))
                  )
                  Or("OR")
                  booleanExpression(
                    booleanExpressionValue(
                      columnPrimary(
                        Identifier("c")
                      )
                      BinaryOperator(">=")
                      valueExpression(IntegerValue("42"))
                    )
                  )
                )
                RParen(")")
              )
            )
          )
        )
      )`
    },
    {
      title: "table alias",
      sql: "SELECT * FROM my_db AS plop",
      expected: `query(
        select(
          Select("SELECT")
          projectionItems(
            projectionItem(Asterisk("*"))
          )
          From("FROM")
          tableExpression(
            tableReference(
              tablePrimary(Identifier("my_db"))
              As("AS")
              Identifier("plop")
            )
          )
        )
      )`
    },
    {
      title: "natural join",
      sql: "SELECT * FROM my_db NATURAL JOIN my_other_db",
      expected: `query(
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
            Natural("NATURAL")
            Join("JOIN")
            tableExpression(
              tableReference(
                tablePrimary(
                  Identifier("my_other_db")
                )
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
        const previous = fs.existsSync("debug.json")
          ? fs.readFileSync("debug.json", "utf-8")
          : "";
        const next =
          "-----------------\n" +
          "   Received\n" +
          "-----------------\n" +
          formatCst(prettifyCst(result.cst.children)) +
          "\n\n-----------------\n" +
          "   Expected\n" +
          "-----------------\n" +
          formatCst(expectedCst);

        if (previous !== next) {
          fs.writeFileSync("debug.json", next);
        }
      }

      expect(formatCst(prettifyCst(result.cst.children))).toEqual(
        formatCst(expectedCst)
      );
    });
  });
});
