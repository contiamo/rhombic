import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { QueryVisitor } from "./QueryVisitor";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { LineageContext } from "./LineageContext";
import { TablePrimary } from "..";

export function getLineage<TableData extends { id: TablePrimary }, ColumnData extends { id: string }>(
  sql: string,
  getTable: (id: TablePrimary) => { table: TableData; columns: ColumnData[] }
): Lineage<TableData, ColumnData> {
  const inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
  const lexer = new SqlBaseLexer(inputStream);
  lexer.doublequoted_identifier = true;
  const tokens = new CommonTokenStream(lexer);
  const parser = new SqlBaseParser(tokens);
  parser.doublequoted_identifier = true;
  parser.buildParseTree = true;
  const tree = parser.statement();

  const lineageContext = new LineageContext(getTable);
  const visitor = new QueryVisitor<TableData, ColumnData>(lineageContext);
  let lineage = tree.accept(visitor);
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
