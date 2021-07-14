import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { QueryVisitor } from "./QueryVisitor";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { LineageContext } from "./LineageContext";

export function getLineage<
  TableData extends { id: string },
  ColumnData extends { id: string }
>(
  sql: string,
  getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  }
): Lineage<TableData, ColumnData> {
  let inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
  let lexer = new SqlBaseLexer(inputStream);
  let tokens = new CommonTokenStream(lexer);
  let parser = new SqlBaseParser(tokens);
  parser.buildParseTree = true;
  let tree = parser.statement();

  let globals = new LineageContext(getters);
  const visitor = new QueryVisitor<TableData, ColumnData>(globals);
  let lineage = tree.accept(visitor);
  let outerRel = globals.relationsStack.pop();
  if (outerRel) {
    lineage = visitor.aggregateResult(lineage, [
      outerRel.toLineage("[final result]")
    ]);
  }
  if (lineage) {
    let maxLevel = 0;
    let tables: Lineage<TableData, ColumnData> = [];
    let edges: Lineage<TableData, ColumnData> = [];
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
      if (e.type == "table") e.level = maxLevel - e.level!;
    });

    return tables.concat(edges);
  } else {
    return [];
  }
}
