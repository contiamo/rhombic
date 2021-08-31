import { Range } from "./utils/getRange";

export type Lineage<TableData, ColumnData> = Array<Table<TableData, ColumnData> | Edge>;

export interface TableModifier {
  type: "filter" | "groupBy";
  range: Range;
}

export interface Table<TableData, ColumnData> {
  type: "table";
  id: string;
  label: string;
  level?: number;
  range?: Range;
  data?: TableData;
  columns: Column<ColumnData>[];
  modifiers?: TableModifier[];
}

export type EdgeType = "select" | "from" | "where" | "group by" | "order by" | "having";

export interface Edge {
  type: "edge";
  label?: string;
  source: {
    tableId: string;
    columnId?: string;
  };
  target: {
    tableId: string;
    columnId?: string;
  };
  edgeType?: EdgeType;
}

export interface Column<ColumnData> {
  id: string;
  label: string;
  isAssumed?: boolean;
  range?: Range;
  data?: ColumnData;
}
