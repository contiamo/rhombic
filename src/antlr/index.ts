import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage, Table } from "../Lineage";
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
    const visitor = new LineageVisitor<TableData, ColumnData>(tp => getTable(this.cursor.removeFrom(tp)));

    this.tree.accept(visitor);
    const tables = visitor.tables;
    const edges = visitor.edges;

    const cleanedTables: Table<TableData, ColumnData>[] = [];

    // do lineage cleanup if mergedLeaves is true
    if (mergedLeaves) {
      // 1. remove duplicate table references from the list of tables
      const deduplicateTable: Map<string, string> = new Map();
      const usedTables: Map<string, string> = new Map();

      tables.forEach(t => {
        if (t.tablePrimary === undefined) {
          cleanedTables.push(t.table);
          return;
        }

        const key = JSON.stringify(t.tablePrimary);
        const entry = usedTables.get(key);
        if (entry !== undefined) {
          deduplicateTable.set(t.table.id, entry);
        } else {
          usedTables.set(key, t.table.id);
          t.table.label = t.tablePrimary.tableName;
          cleanedTables.push(t.table);
        }
      });

      // 2. remove references to duplicate tables from edges and collect used columns of tables
      const usedColumns: Map<string, string[]> = new Map();

      edges.forEach(e => {
        const remappedSourceTable = deduplicateTable.get(e.source.tableId);
        if (remappedSourceTable !== undefined) {
          e.source.tableId = remappedSourceTable;
        }
        if (e.source.columnId !== undefined) {
          const columns = usedColumns.get(e.source.tableId);
          if (columns !== undefined) {
            columns.push(e.source.columnId);
          } else {
            usedColumns.set(e.source.tableId, [e.source.columnId]);
          }
        }
      });

      // 3. leave only columns that are used in tables
      cleanedTables.forEach(t => {
        if (t.data !== undefined) {
          const tableColumns = usedColumns.get(t.id);
          t.columns = t.columns.filter(c => tableColumns?.includes(c.id));
        }
      });
    } else {
      tables.forEach(t => cleanedTables.push(t.table));
    }

    return ([] as Lineage<TableData, ColumnData>).concat(cleanedTables, edges);
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
