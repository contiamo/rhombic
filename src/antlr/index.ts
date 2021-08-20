import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
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
    const visitor = new LineageVisitor<TableData, ColumnData>(getTable, mergedLeaves);
    this.tree.accept(visitor);
    const outerRel = visitor.relationsStack.pop();
    if (outerRel) {
      visitor.onRelation(outerRel, "[final result]");
    }
    const lineage = visitor.lineage;
    let maxLevel = 0;
    const tables: Lineage<TableData, ColumnData> = [];
    const edges: Lineage<TableData, ColumnData> = [];
    const usedColumns: Map<string, string[]> = new Map();
    lineage.forEach(e => {
      if (e.type == "table") {
        if (e.level !== undefined && e.level > maxLevel) {
          maxLevel = e.level;
        }
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
        if (e.level !== undefined) e.level = maxLevel - e.level;
        if (mergedLeaves && e.data !== undefined) {
          // used column filtering
          const tableColumns = usedColumns.get(e.id);
          e.columns = e.columns.filter(c => tableColumns?.includes(c.id));
        }
      }
    });

    return tables.concat(edges);
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
