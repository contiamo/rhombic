import { Column, Lineage, Table } from "../Lineage";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { Range } from "../utils/getRange";

export enum Clause {
  From,
  Select,
  Other
}

export class Relation<TableData, ColumnData> {
  id: string;
  columns: Array<Column<ColumnData>>;
  level: number;
  name?: string;
  range?: Range;
  data?: TableData;

  constructor(
    id: string,
    columns: Array<Column<ColumnData>>,
    level: number,
    range?: Range,
    data?: TableData,
    name?: string // name is defined for real tables
  ) {
    this.id = id;
    this.columns = columns;
    this.level = level;
    this.name = name;
    this.range = range;
    this.data = data;
  }

  toLineage(label?: string): Table<TableData, ColumnData> {
    let l = this.id;
    if (this.name) {
      if (label && label != this.name) {
        l = `${this.name} -> ${label}`;
      } else {
        l = this.name;
      }
    } else if (label) {
      l = label;
    }

    return {
      type: "table",
      id: this.id,
      label: l,
      level: this.level,
      range: this.range,
      columns: this.columns
    };
  }
}

type ColumnRef = { tableId: string; columnId: string };

export class QueryVisitor<
  TableData extends { id: string },
  ColumnData extends { id: string }
> extends AbstractParseTreeVisitor<Lineage<TableData, ColumnData>>
  implements SqlBaseVisitor<Lineage<TableData, ColumnData>> {
  // sequence generator for columns in this context
  private columnIdSeq: number = 0;

  // columns for this query extracted from SELECT
  columns: Array<Column<ColumnData>> = new Array();

  // relations for this context extracted from FROM
  relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  // parent reference, used for name resolution
  readonly parent?: QueryVisitor<TableData, ColumnData>;
}
