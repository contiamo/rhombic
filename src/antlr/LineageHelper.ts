import { Edge, EdgeType, isTable, isEdge, Lineage, Table, Column, LineageElement } from "../Lineage";

interface FocusedTable {
  type: "table";
  tableId: string;
}

interface FocusedColumn {
  type: "column";
  tableId: string;
  columnId: string;
}

interface FocusedEdge {
  type: "edge";
  /**
   * Table/column that is depended on. If `columnId` is undefined then it is a table. Otherwise it is
   * a column inside the table.
   */
  source: {
    tableId: string;
    columnId?: string;
  };

  /**
   * Dependent table/column. If `columnId` is undefined then it is a table. Otherwise it is
   * a column inside the table.
   */
  target: {
    tableId: string;
    columnId?: string;
  };

  /** Edge type. See #EdgeType */
  edgeType?: EdgeType;
}

export type FocusedElement = FocusedTable | FocusedColumn | FocusedEdge;

export interface ColumnReference<ColumnData> {
  type: "column";
  tableId: string;
  column: Column<ColumnData>;
}

export const toFocusedElement = <TableData, ColumnData>(
  element: LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>
): FocusedElement => {
  switch (element.type) {
    case "table":
      return { type: "table", tableId: element.id };
    case "column":
      return { type: "column", tableId: element.tableId, columnId: element.column.id };
    case "edge":
      return element;
  }
};

/**
 * "up" => upstream dependencies
 * "down" => downstream dependencies
 */
export type Direction = "up" | "down";

const edgeFinder = (edges: Edge[]) => (focusedEdge: FocusedEdge): Edge | undefined =>
  edges.find(
    element =>
      element.source.tableId === focusedEdge.source.tableId &&
      element.source.columnId === focusedEdge.source.columnId &&
      element.target.tableId === focusedEdge.target.tableId &&
      element.target.columnId === focusedEdge.target.columnId &&
      element.edgeType === focusedEdge.edgeType
  );

const edgesBySourceFinder = (edges: Edge[]) => (focusedElement: FocusedTable | FocusedColumn) =>
  edges.filter(
    element =>
      element.source.tableId === focusedElement.tableId &&
      ((focusedElement.type === "column" && element.source.columnId === focusedElement.columnId) ||
        (focusedElement.type === "table" && element.source.columnId === undefined))
  );

const edgesByTargetFinder = (edges: Edge[]) => (focusedElement: FocusedTable | FocusedColumn) =>
  edges.filter(
    element =>
      element.target.tableId === focusedElement.tableId &&
      ((focusedElement.type === "column" && element.target.columnId === focusedElement.columnId) ||
        (focusedElement.type === "table" && element.target.columnId === undefined))
  );

const tableFinder = <TableData, ColumnData>(tables: Table<TableData, ColumnData>[]) => (
  focusedTable: FocusedTable
): Table<TableData, ColumnData> | undefined => tables.find(element => element.id === focusedTable.tableId);

const columnFinder = <TableData, ColumnData>(tables: Table<TableData, ColumnData>[]) => (
  focusedColumn: FocusedColumn
): ColumnReference<ColumnData> | undefined => {
  const table = tableFinder(tables)({ type: "table", tableId: focusedColumn.tableId });
  if (!table) return;
  const column = table.columns.find(column => column.id === focusedColumn.columnId);
  if (!column) return;
  return {
    type: "column",
    tableId: table.id,
    column
  };
};

export const LineageHelper = <TableData, ColumnData>(lineage: Lineage<TableData, ColumnData>) => {
  const tables = lineage.filter(isTable);
  const edges = lineage.filter(isEdge);
  const findEdge = edgeFinder(edges);
  const findEdgesFromSource = edgesBySourceFinder(edges);
  const findEdgesToTarget = edgesByTargetFinder(edges);
  const findTable = tableFinder(tables);
  const findColumn = columnFinder(tables);

  const walkUp = (focus: FocusedElement) => {
    if (focus.type === "table" || focus.type === "column") {
      return findEdgesToTarget(focus);
    }
    // Edge
    const tableOrColumn =
      focus.source.columnId !== undefined
        ? findColumn({ type: "column", tableId: focus.source.tableId, columnId: focus.source.columnId })
        : findTable({ type: "table", tableId: focus.source.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  const walkDown = (focus: FocusedElement) => {
    if (focus.type === "table" || focus.type === "column") {
      return findEdgesFromSource(focus);
    }
    // Edge
    const tableOrColumn =
      focus.target.columnId !== undefined
        ? findColumn({ type: "column", tableId: focus.target.tableId, columnId: focus.target.columnId })
        : findTable({ type: "table", tableId: focus.target.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  // Texas Ranger
  const walker = (
    focus: FocusedElement,
    direction: Direction,
    eachElement: (element: LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>) => void
  ) => {
    (direction === "up" ? walkUp : walkDown)(focus).forEach(element => {
      eachElement(element);
      walker(toFocusedElement(element), direction, eachElement);
    });
  };

  const findConnectedElements = (focus: FocusedElement) => {
    // Check that the element exists and include it in the connected elements
    const element =
      focus.type === "table" ? findTable(focus) : focus.type === "column" ? findColumn(focus) : findEdge(focus);
    if (!element) throw Error(`Element not found in lineage - ${JSON.stringify(focus)}`);
    const elements: Array<LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>> = [element];
    const collect = (element: LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>) =>
      elements.push(element);
    walker(focus, "up", collect);
    walker(focus, "down", collect);
    return elements;
  };

  return {
    findEdgesFromSource,
    findEdgesToTarget,
    findTable,
    findColumn,
    findConnectedElements
  };
};
