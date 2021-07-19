import { Lineage } from "../Lineage";
import { Relation } from "./model";

export class LineageContext<TableData, ColumnData> {
  getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  };

  relationSeq = 0;
  relationsStack: Array<Relation<TableData, ColumnData>> = [];
  lineage: Lineage<TableData, ColumnData> = [];

  constructor(getters: { getTable: (tableId: string) => TableData; getColumns: (tableId: string) => ColumnData[] }) {
    this.getters = getters;
  }

  get nextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }
}
