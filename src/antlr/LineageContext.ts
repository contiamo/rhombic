import { Column, Lineage, Table } from "../Lineage";
import { Range } from "../utils/getRange";

export enum Clause {
  From,
  Select,
  Other
}

export class Relation<TableData, ColumnData> {
  id: string;
  columns: Array<Column<ColumnData>>;
  range?: Range;
  data?: TableData;

  constructor(
    id: string,
    columns: Array<Column<ColumnData>>,
    range?: Range,
    data?: TableData
  ) {
    this.id = id;
    this.columns = columns;
    this.range = range;
    this.data = data;
  }

  toLineage(label?: string): Table<TableData, ColumnData> {
    return {
      type: "table",
      id: this.id,
      label: label ?? this.id,
      range: this.range,
      columns: this.columns
    };
  }
}

export class LineageContext<TableData, ColumnData> {
  columnIdSeq: number = 0;

  columns: Array<Column<ColumnData>> = new Array();
  relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  readonly parent?: LineageContext<TableData, ColumnData>;
  currentClause: Clause = Clause.Other;

  constructor(parent?: LineageContext<TableData, ColumnData>) {
    this.parent = parent;
  }

  toRelation(id: string, range?: Range): Relation<TableData, ColumnData> {
    return new Relation<TableData, ColumnData>(id, this.columns, range);
  }

  getNextColumnId(): string {
    this.columnIdSeq++;
    return "column_" + this.columnIdSeq;
  }

  getRelationsLineage(): Lineage<TableData, ColumnData> {
    let lin: Lineage<TableData, ColumnData> = new Array();
    this.relations.forEach((val, key) => {
      lin.push(val.toLineage(key));
    });
    return lin;
  }
}
