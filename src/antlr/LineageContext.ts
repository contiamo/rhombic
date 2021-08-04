import { TablePrimary } from "..";
import { Relation } from "./common";

// Instance of this class is shared across query visitors which are used to process
// individual (sub-)queries
export class LineageContext<TableData, ColumnData> {
  private relationSeq = 0;
  public readonly relationsStack: Array<Relation<TableData, ColumnData>> = [];

  constructor(
    public getTable: (
      table: TablePrimary
    ) => { table: { id: string; data: TableData }; columns: { id: string; data: ColumnData }[] } | undefined
  ) {}

  getNextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }
}
