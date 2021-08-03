import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { LineageQueryVisitor } from "./LineageQueryVisitor";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser, StatementContext } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { LineageContext } from "./LineageContext";
import { TablePrimary } from "..";
import { ExtractTablesVisitor } from "./ExtractTablesVisitor";

interface ParserOptions {
  doubleQuotedIdentifier?: boolean;
}

class SqlParseTree {
  constructor(public readonly tree: StatementContext) {}

  getUsedTables(): TablePrimary[] {
    const visitor = new ExtractTablesVisitor();
    return this.tree.accept(visitor);
  }

  getLineage<TableData extends { id: TablePrimary }, ColumnData extends { id: string }>(
    getTable: (id: TablePrimary) => { table: TableData; columns: ColumnData[] } | undefined
  ): Lineage<TableData, ColumnData> {
    const lineageContext = new LineageContext(getTable);
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
    return new SqlParseTree(parser.statement());
  }
};

export default antlr;
