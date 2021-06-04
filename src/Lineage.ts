import { Range } from "./utils/getRange";

export type Lineage<TableData, ColumnData> = Array<
  Table<TableData, ColumnData> | Edge
>;

export interface Table<TableData, ColumnData> {
  type: "table";
  id: string;
  label: string;
  range?: Range;
  data?: TableData;
  columns: Column<ColumnData>[];
  modifiers?: Array<{ type: "filter" | "groupBy"; range: Range }>;
}

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
}

export interface Column<ColumnData> {
  id: string;
  label: string;
  range?: Range;
  data?: ColumnData;
}
