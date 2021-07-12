import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage } from "../Lineage";
import { LineageListener } from "./LineageListener";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

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

  const listener = new LineageListener<TableData, ColumnData>(getters);
  // Use the entry point for listeners
  ParseTreeWalker.DEFAULT.walk(listener as ParseTreeListener, tree);
  let lineage = listener.lineage;
  let outerRel = listener.relationsStack.pop();
  if (outerRel) {
    lineage.push(outerRel.toLineage("[final result]"));
  }
  return lineage;
}
