import antlr from ".";
import { TablePrimary } from "..";
import { CompletionItem } from "./CompletionVisitor";

const env = new Map<string, string[]>();
env.set("test", ["column1", "column2"]);

describe("completion", () => {
  it("should complete columns in simple query", () => {
    const sql = "SELECT <|> FROM test";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should complete columns in simple query", () => {
    const sql = "SELECT column1<|> FROM test";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should complete columns in simple query with syntax error", () => {
    const sql = "SELECT column1, <|> FROM test";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should complete columns in subquery", () => {
    const sql = "SELECT * FROM (SELECT <|> FROM test)";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should complete columns in simple multiline query", () => {
    const sql = "SELECT\n  column1,\n  column2,\n  <|>\nFROM\n  test";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should complete tables in simple query", () => {
    const sql = "SELECT column1 FROM test<|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([rel("test")]);
  });

  it("should complete tables in simple query with syntax error", () => {
    const sql = "SELECT column1 FROM test, <|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([rel("test")]);
  });

  it("should complete tables in subquery", () => {
    const sql = "SELECT column1 FROM (SELECT column1 FROM <|>)";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([rel("test")]);
  });

  it("should complete tables in simple multiline query", () => {
    const sql = "SELECT\n  column1\nFROM\n  test,\n  <|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([rel("test")]);
  });

  it("should suggest the SELECTFROM snippet on empty input", () => {
    const sql = "";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([snp("SELECT ? FROM ?", "SELECT $0 FROM $1")]);
  });

  it("should suggest the SELECTFROM snippet in subquery position", () => {
    const sql = "SELECT a, b FROM (<|>)";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([snp("SELECT ? FROM ?", "SELECT $0 FROM $1"), rel("test")]);
  });

  it("should suggest columns from aliased tables", () => {
    const sql = "SELECT <|> FROM test t";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("t", "column1"), col("t", "column2")]);
  });

  it("should suggest columns from a referenced table", () => {
    const sql = "WITH tmp (a) (SELECT 1) SELECT tmp.<|> FROM test, tmp";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("tmp", "a")]);
  });

  it("should suggest columns from a referenced table with prefix", () => {
    const sql = "WITH tmp (a) (SELECT 1) SELECT t.a<|> FROM test, tmp t";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("t", "a")]);
  });

  it("should suggest columns in where clauses", () => {
    const sql = "SELECT * FROM test WHERE <|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should suggest columns in sort clauses", () => {
    const sql = "SELECT * FROM test ORDER BY <|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("test", "column1"), col("test", "column2")]);
  });

  it("should suggest columns for aliased queries in join criterias", () => {
    const sql = "SELECT * FROM test t JOIN (SELECT column1 FROM test) s ON <|>";

    const completionResult = runCompletion(sql, env);
    expect(completionResult).toEqual([col("t", "column1"), col("t", "column2"), col("s", "column1")]);
  });
});

function col(rel: string, name?: string): CompletionItem {
  if (name === undefined) {
    return { type: "column", value: rel };
  } else {
    return { type: "column", relation: rel, value: name };
  }
}

function rel(name: string): CompletionItem {
  return { type: "relation", value: name };
}

function snp(label: string, template: string): CompletionItem {
  return { type: "snippet", label, template };
}

function runCompletion(sql: string, env: Map<string, string[]>): CompletionItem[] {
  const lines = sql.split("\n");
  let position = { lineNumber: 1, column: 1 };

  const cleanedSql = lines
    .map((line, idx) => {
      const caretIdx = line.indexOf("<|>");
      if (caretIdx !== -1) {
        position = { lineNumber: idx + 1, column: caretIdx + 1 };
        return line.replace("<|>", "");
      }
      return line;
    })
    .join("\n");

  function getTables(): TablePrimary[] {
    return Array.from(env.keys()).map(name => {
      return {
        tableName: name
      };
    });
  }

  function getTable(
    t: TablePrimary
  ): { table: { id: string; data: any }; columns: { id: string; data: any }[] } | undefined {
    const cs = env.get(t.tableName);
    if (cs !== undefined) {
      return {
        table: { id: t.tableName, data: {} },
        columns: cs.map(c => {
          return {
            id: c,
            data: {}
          };
        })
      };
    } else {
      return undefined;
    }
  }

  return antlr.suggest(cleanedSql, position, getTables, getTable);
}
