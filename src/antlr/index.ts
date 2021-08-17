import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { LineageQueryVisitor } from "./LineageQueryVisitor";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser, StatementContext } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { LineageContext } from "./LineageContext";
import { TablePrimary } from "..";
import { ExtractTablesVisitor } from "./ExtractTablesVisitor";
import { CompletionVisitor, Position } from "./CompletionsVisitor";

interface ParserOptions {
  doubleQuotedIdentifier?: boolean;
}

class SqlParseTree {
  constructor(public readonly tree: StatementContext) {}

  getUsedTables(): TablePrimary[] {
    const visitor = new ExtractTablesVisitor();
    return this.tree.accept(visitor);
  }

  getLineage<TableData, ColumnData>(
    getTable: (
      id: TablePrimary
    ) => { table: { id: string; data: TableData }; columns: { id: string; data: ColumnData }[] } | undefined,
    mergedLeaves?: boolean
  ): Lineage<TableData, ColumnData> {
    const lineageContext = new LineageContext(getTable, mergedLeaves ?? false);
    const visitor = new LineageQueryVisitor<TableData, ColumnData>(lineageContext);
    let lineage = this.tree.accept(visitor);
    const outerRel = lineageContext.relationsStack.pop();
    if (outerRel) {
      lineage = visitor.aggregateResult(lineage, [outerRel.toLineage("[final result]")]);
    }
    if (lineage) {
      let maxLevel = 0;
      const tables: Lineage<TableData, ColumnData> = [];
      const edges: Lineage<TableData, ColumnData> = [];
      lineage.forEach(e => {
        if (e.type == "table") {
          if (e.level !== undefined && e.level > maxLevel) {
            maxLevel = e.level;
          }
          tables.push(e);
        } else {
          edges.push(e);
        }
      });
      tables.forEach(e => {
        if (e.type == "table" && e.level !== undefined) e.level = maxLevel - e.level;
      });

      return tables.concat(edges);
    } else {
      return [];
    }
  }
}

export type Completion =
  | { type: "keyword"; value: string }
  | { type: "relation"; name: string }
  | { type: "column"; relation: string; name: string }
  | { type: "snippet"; label: string; template: string };

const antlr = {
  parse(sql: string, options?: ParserOptions): SqlParseTree {
    const doubleQuotedIdentifier = options?.doubleQuotedIdentifier ?? false;

    const inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
    const lexer = new SqlBaseLexer(inputStream);
    lexer.doublequoted_identifier = doubleQuotedIdentifier;
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.doublequoted_identifier = doubleQuotedIdentifier;
    parser.buildParseTree = true;
    parser.removeErrorListeners();
    return new SqlParseTree(parser.statement());
  },

  complete(sql: string, env: Map<string, string[]>, position: Position, options?: ParserOptions): Completion[] {
    const doubleQuotedIdentifier = options?.doubleQuotedIdentifier ?? false;

    let idx = 0,
      l = position.lineNumber;
    for (; idx <= sql.length && l > 1; idx++) {
      if (sql.charAt(idx) === "\n") {
        l--;
      }
    }
    idx += position.column - 1;
    const start = sql.slice(0, idx),
      end = sql.slice(idx);

    const sqlWithCaret = start + CompletionVisitor.CURSOR_MARKER + end;

    const inputStream = new UppercaseCharStream(CharStreams.fromString(sqlWithCaret));
    const lexer = new SqlBaseLexer(inputStream);
    lexer.doublequoted_identifier = doubleQuotedIdentifier;
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.doublequoted_identifier = doubleQuotedIdentifier;
    parser.buildParseTree = true;

    parser.removeErrorListeners();

    const ast = parser.statement();

    const completionVisitor = new CompletionVisitor(env);
    ast.accept(completionVisitor);

    const completions: Completion[] = [];
    const result = completionVisitor.getResult();
    const scope = result.scope;
    switch (scope.type) {
      case "column":
        result.queryInfo.availableColumns.forEach(cd => {
          completions.push({ type: "column", relation: cd.relation, name: cd.name });
        });
        break;
      case "relation":
        result.queryInfo.availableRelations.forEach(rel => {
          completions.push({ type: "relation", name: rel });
        });
        break;
      case "dereference":
        result.queryInfo.availableColumns.forEach(cd => {
          if (cd.relation === scope.relation) {
            completions.push({ type: "column", relation: scope.relation, name: cd.name });
          }
        });
        break;
    }

    result.snippets.forEach(s => {
      completions.push({
        type: "snippet",
        label: s.label,
        template: s.template
      });
    });

    return completions;
  }
};

export default antlr;
