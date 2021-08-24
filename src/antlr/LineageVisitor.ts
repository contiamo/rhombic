import { TablePrimary } from "..";
import { Lineage } from "../Lineage";
import { QueryStructureVisitor, TableRelation, QueryRelation } from "./QueryStructureVisitor";

export class LineageVisitor<TableData, ColumnData> extends QueryStructureVisitor<void> {
  lineage: Lineage<TableData, ColumnData> = [];
  // map from tablePrimary to tableId
  private usedTables: Map<string, string> = new Map();
  // map from tableId to deduplicated tableId
  private deduplicateTables: Map<string, string> = new Map();

  constructor(
    getTable: (
      table: TablePrimary
    ) => { table: { id: string; data: TableData }; columns: { id: string; data: ColumnData }[] } | undefined,
    readonly mergedLeaves?: boolean
  ) {
    super(getTable);
  }

  //
  // Overrides
  //

  onColumnReference(tableId: string, columnId: string): void {
    const sourceTableId = this.mergedLeaves ? this.deduplicateTables.get(tableId) ?? tableId : tableId;
    this.lineage.push({
      type: "edge",
      edgeType: this.currentRelation.currentClause,
      source: {
        tableId: sourceTableId,
        columnId: columnId
      },
      target: {
        tableId: this.currentRelation.id,
        columnId: this.currentRelation.currentColumnId
      }
    });
  }

  onRelation(relation: TableRelation | QueryRelation, alias?: string): void {
    let label = alias ?? relation.id;
    if (relation instanceof TableRelation) {
      if (this.mergedLeaves) {
        const key = JSON.stringify(relation.tablePrimary);
        const existing = this.usedTables.get(key);
        if (existing !== undefined) {
          this.deduplicateTables.set(relation.id, existing);
          return;
        } else {
          this.usedTables.set(key, relation.id);
        }
        label = relation.tablePrimary.tableName;
      } else {
        label =
          alias !== undefined && alias != relation.tablePrimary.tableName
            ? relation.tablePrimary.tableName + " -> " + alias
            : relation.tablePrimary.tableName;
      }
    }
    this.lineage.push({
      type: "table",
      id: relation.id,
      label: label,
      range: relation.range,
      data: relation instanceof TableRelation ? (relation.data as TableData) : undefined,
      columns: relation.columns.map(c => {
        return {
          id: c.id,
          label: c.label,
          range: c.range,
          data: c.data as ColumnData
        };
      })
    });
  }

  protected defaultResult(): void {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  aggregateResult(_aggregate: void, _nextResult: void): void {
    return;
  }
}
