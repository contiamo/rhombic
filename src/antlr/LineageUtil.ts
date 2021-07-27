import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { QueryVisitor } from "./QueryVisitor";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { LineageContext } from "./LineageContext";

export function getLineage<TableData extends { id: string }, ColumnData extends { id: string }>(
  sql: string,
  getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  }
): Lineage<TableData, ColumnData> {
  const inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
  const lexer = new SqlBaseLexer(inputStream);
  lexer.doublequoted_identifier = true;
  const tokens = new CommonTokenStream(lexer);
  const parser = new SqlBaseParser(tokens);
  parser.doublequoted_identifier = true;
  parser.buildParseTree = true;
  const tree = parser.statement();

  const globals = new LineageContext(getters);
  const visitor = new QueryVisitor<TableData, ColumnData>(globals);
  let lineage = tree.accept(visitor);
  const outerRel = globals.relationsStack.pop();
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
