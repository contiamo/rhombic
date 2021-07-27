import { Relation } from "./model";

export class LineageContext<TableData, ColumnData> {
  getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  };

  private relationSeq = 0;
  public readonly relationsStack: Array<Relation<TableData, ColumnData>> = [];

  constructor(getters: { getTable: (tableId: string) => TableData; getColumns: (tableId: string) => ColumnData[] }) {
    this.getters = getters;
  }

  getNextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }
}
