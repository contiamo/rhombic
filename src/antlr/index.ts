import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage, Table } from "../Lineage";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser, StatementContext } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { TablePrimary } from "..";
import { ExtractTablesVisitor } from "./ExtractTablesVisitor";
import { LineageVisitor } from "./LineageVisitor";

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
    const visitor = new LineageVisitor<TableData, ColumnData>(getTable);
    this.tree.accept(visitor);
    let { tables, edges } = visitor.lineage;

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
}

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
  }
};

export default antlr;
