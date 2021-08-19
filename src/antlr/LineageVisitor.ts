import { TablePrimary } from "..";
import { Lineage, Table } from "../Lineage";
import { QueryStructureVisitor, Relation, TableRelation, QueryRelation } from "./QueryStructureVisitor";

export class LineageVisitor<TableData, ColumnData> extends QueryStructureVisitor<void, TableData, ColumnData> {
  lineage: Lineage<TableData, ColumnData> = [];

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

  protected defaultResult(): Lineage<TableData, ColumnData> | undefined {
    return undefined;
  }

  onColumnReference(tableId: string, columnId: string): void {
    this.lineage.push({
      type: "edge",
      edgeType: this.currentRelation.currentClause,
      source: {
        tableId: tableId,
        columnId: columnId
      },
      target: {
        tableId: this.currentRelation.id,
        columnId: this.currentRelation.currentColumnId
      }
    });
  }

  // type: "table";
  // id: string;
  // label: string;
  // level?: number;
  // range?: Range;
  // data?: TableData;
  // columns: Column<ColumnData>[];
  // modifiers?: TableModifier[];

  onRelation(relation: Relation<ColumnData>, alias?: string): void {
    if (relation instanceof TableRelation) {
      relation;
    }
    //   relation.
    // }
    this.lineage.push({
      type: "table",
      id: relation.id,
      label: alias ?? "",
      // TODO
      // level: relation.
      range: relation.range,
      // data:
      columns: relation.columns
    });
  }

  aggregateResult(
    aggregate: Lineage<TableData, ColumnData> | undefined,
    nextResult: Lineage<TableData, ColumnData> | undefined
  ): Lineage<TableData, ColumnData> | undefined {
    if (nextResult) {
      if (aggregate) {
        const additional: Lineage<TableData, ColumnData> = [];
        for (const e of nextResult) {
          if (e.type == "table" && e.level !== undefined) {
            const level = e.level;
            const existing = aggregate.find(
              t => t.type == "table" && t.id == e.id && t.level !== undefined && level >= t.level
            ) as Table<TableData, ColumnData>;
            if (existing !== undefined) {
              existing.level = level;
            } else {
              additional.push(e);
            }
          } else {
            additional.push(e);
          }
        }
        return aggregate.concat(additional);
      } else {
        return nextResult;
      }
    } else {
      return aggregate;
    }
  }
}
