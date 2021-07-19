import { Column, Table } from "../Lineage";
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

export type ColumnRef = { tableId: string; columnId: string };

export type QuotableIdentifier = { name: string; quoted: boolean };
