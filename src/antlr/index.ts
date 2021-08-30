import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser, StatementContext } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { TablePrimary } from "..";
import { ExtractTablesVisitor } from "./ExtractTablesVisitor";
import { LineageVisitor } from "./LineageVisitor";
import { CompletionItem, CompletionVisitor } from "./CompletionVisitor";
import { Cursor } from "./Cursor";
import _ from "lodash";

interface ParserOptions {
  doubleQuotedIdentifier?: boolean;
  cursorPosition?: { lineNumber: number; column: number };
}

type TableListProvider = () => TablePrimary[];
type TableProvider<T, C> = (
  id: TablePrimary
) => { table: { id: string; data: T }; columns: { id: string; data: C }[] } | undefined;

class SqlParseTree {
  constructor(public readonly tree: StatementContext, readonly cursor: Cursor) {}

  getUsedTables(): TablePrimary[] {
    const visitor = new ExtractTablesVisitor(this.cursor);
    return this.tree.accept(visitor);
  }

  getLineage<TableData, ColumnData>(
    getTable: TableProvider<TableData, ColumnData>,
    mergedLeaves?: boolean
  ): Lineage<TableData, ColumnData> {
    const visitor = new LineageVisitor<TableData, ColumnData>(tp => getTable(this.cursor.removeFrom(tp)), mergedLeaves);
    this.tree.accept(visitor);
    const lineage = visitor.lineage;
    const tables: Lineage<TableData, ColumnData> = [];
    const edges: Lineage<TableData, ColumnData> = [];
    const usedColumns: Map<string, string[]> = new Map();
    lineage.forEach(e => {
      if (e.type == "table") {
        tables.push(e);
      } else {
        if (mergedLeaves && e.source.columnId !== undefined) {
          // used column filtering preparation
          const columns = usedColumns.get(e.source.tableId);
          if (columns !== undefined) {
            columns.push(e.source.columnId);
          } else {
            usedColumns.set(e.source.tableId, [e.source.columnId]);
          }
        }
        edges.push(e);
      }
    });

    tables.forEach(e => {
      if (e.type == "table") {
        if (mergedLeaves && e.data !== undefined) {
          // used column filtering
          const tableColumns = usedColumns.get(e.id);
          e.columns = e.columns.filter(c => tableColumns?.includes(c.id));
        }
      }
    });

    return tables.concat(edges);
  }

  getSuggestions(getTables: TableListProvider, getTable: TableProvider<any, any>): CompletionItem[] {
    const completionVisitor = new CompletionVisitor(defaultCursor, getTables, tp =>
      getTable(this.cursor.removeFrom(tp))
    );
    this.tree.accept(completionVisitor);

    return completionVisitor.getSuggestions();
  }
}

const defaultCursor = new Cursor("_CURSOR_");

const antlr = {
  parse(sql: string, options?: ParserOptions): SqlParseTree {
    const doubleQuotedIdentifier = options?.doubleQuotedIdentifier ?? false;

    if (options?.cursorPosition !== undefined) {
      sql = defaultCursor.insertAt(sql, options.cursorPosition);
    }

    const inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
    const lexer = new SqlBaseLexer(inputStream);
    lexer.doublequoted_identifier = doubleQuotedIdentifier;
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.doublequoted_identifier = doubleQuotedIdentifier;
    parser.buildParseTree = true;
    parser.removeErrorListeners();
    return new SqlParseTree(parser.statement(), defaultCursor);
  }
};

export default antlr;
