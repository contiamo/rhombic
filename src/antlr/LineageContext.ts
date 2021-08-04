import { TablePrimary } from "..";
import { Relation } from "./common";

// Instance of this class is shared across query visitors which are used to process
// individual (sub-)queries
export class LineageContext<TableData, ColumnData> {
  private relationSeq = 0;
  public readonly usedTables: Map<string, Relation<TableData, ColumnData>> = new Map();
  public readonly relationsStack: Array<Relation<TableData, ColumnData>> = [];

  constructor(
    public getTable: (
      table: TablePrimary
    ) => { table: { id: string; data: TableData }; columns: { id: string; data: ColumnData }[] } | undefined,
    public readonly mergedLeaves: boolean
  ) {}

  getNextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }
}
