import { Column, Table } from "../Lineage";
import { Range } from "../utils/getRange";

export enum Clause {
  From,
  Select,
  Other
}

export class Relation<TableData, ColumnData> {
  constructor(
    public readonly id: string,
    public readonly columns: Array<Column<ColumnData>>,
    public readonly level: number,
    public readonly range?: Range,
    public readonly data?: TableData,
    public readonly name?: string // name is defined for real tables
  ) {}

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
      data: this.data,
      columns: this.columns
    };
  }
}

export type ColumnRef = { tableId: string; columnId: string };

export type QuotableIdentifier = { name: string; quoted: boolean };
