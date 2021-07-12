import { Column, Lineage, Table } from "../Lineage";
import { Range } from "../utils/getRange";
import { DereferenceContext } from "./SqlBaseParser";

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

export class LineageContext<TableData, ColumnData> {
  // sequence generator for columns in this context
  private columnIdSeq: number = 0;

  // columns for this query extracted from SELECT
  columns: Array<Column<ColumnData>> = new Array();

  // relations for this context extracted from FROM
  relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  // parent reference, used for name resolution
  readonly parent?: LineageContext<TableData, ColumnData>;

  // to be able to stop resolving once resolved
  resolvedDereference?: DereferenceContext;

  columnReferences: Array<ColumnRef> = new Array();

  currentClause: Clause = Clause.Other;

  constructor(parent?: LineageContext<TableData, ColumnData>) {
    this.parent = parent;
  }

  get level(): number {
    let level = 0;
    let cur: LineageContext<TableData, ColumnData> | undefined = this;
    while (cur?.parent !== undefined) {
      level++;
      cur = cur.parent;
    }
    return level;
  }

  findRelation(tableName: string): Relation<TableData, ColumnData> | undefined {
    let cur = this;
    while (cur != undefined) {
      let table = cur.relations.get(tableName);
      if (table !== undefined) return table;
    }
    return undefined;
  }

  resolveColumn(columnName: string, tableName?: string): ColumnRef | undefined {
    if (tableName !== undefined) {
      let table = this.findRelation(tableName);
      let col = table?.columns.find(c => c.label == columnName);
      if (table && col) {
        return { tableId: table.id, columnId: col.id };
      }
    } else {
      for (let r of this.relations) {
        let col = r[1].columns.find(c => c.label == columnName);
        if (col) {
          return { tableId: r[1].id, columnId: col.id };
        }
      }
    }
    return undefined;
  }

  toRelation(id: string, range?: Range): Relation<TableData, ColumnData> {
    return new Relation<TableData, ColumnData>(
      id,
      this.columns,
      this.level,
      range
    );
  }

  get nextColumnId(): string {
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
