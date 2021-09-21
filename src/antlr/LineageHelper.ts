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

export type MatchedElement<TableData, ColumnData> = LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>;

export interface ColumnReference<ColumnData> {
  type: "column";
  tableId: string;
  column: Column<ColumnData>;
}

export const toFocusedElement = <TableData, ColumnData>(
  element: MatchedElement<TableData, ColumnData>
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

/**
 * Lineage Helper provides useful functions to work with an extracted lineage graph
 */
export const LineageHelper = <TableData, ColumnData>(lineage: Lineage<TableData, ColumnData>) => {
  const tables = lineage.filter(isTable);
  const edges = lineage.filter(isEdge);
  const findEdge = edgeFinder(edges);
  const findTable = tableFinder(tables);
  const findColumn = columnFinder(tables);
  const findElement = (focus: FocusedElement) =>
    focus.type === "table" ? findTable(focus) : focus.type === "column" ? findColumn(focus) : findEdge(focus);
  const findEdgesFromSource = edgesBySourceFinder(edges);
  const findEdgesToTarget = edgesByTargetFinder(edges);

  const walkUp = (focus: FocusedElement) => {
    if (focus.type === "table" || focus.type === "column") {
      return findEdgesToTarget(focus);
    }
    // it's and edge
    const tableOrColumn =
      focus.source.columnId !== undefined
        ? findElement({ type: "column", tableId: focus.source.tableId, columnId: focus.source.columnId })
        : findElement({ type: "table", tableId: focus.source.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  const walkDown = (focus: FocusedElement) => {
    if (focus.type === "table" || focus.type === "column") {
      return findEdgesFromSource(focus);
    }
    // it's and edge
    const tableOrColumn =
      focus.target.columnId !== undefined
        ? findElement({ type: "column", tableId: focus.target.tableId, columnId: focus.target.columnId })
        : findElement({ type: "table", tableId: focus.target.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  // Texas Ranger
  const walker = (
    focus: FocusedElement,
    direction: Direction,
    eachElement: (element: MatchedElement<TableData, ColumnData>) => void
  ) => {
    (direction === "up" ? walkUp : walkDown)(focus).forEach(element => {
      eachElement(element);
      walker(toFocusedElement(element), direction, eachElement);
    });
  };

  const findConnectedElements = (focus: FocusedElement) => {
    // Check that the focused element exists and include it in the connected elements
    const element = findElement(focus);
    if (!element) throw Error(`Element not found in lineage - ${JSON.stringify(focus)}`);
    const elements: MatchedElement<TableData, ColumnData>[] = [element];
    const collect = (element: MatchedElement<TableData, ColumnData>) => elements.push(element);
    walker(focus, "up", collect);
    walker(focus, "down", collect);
    return elements;
  };

  return {
    /**
     * Finds an element (table, column, edge) in the lineage graph
     */
    findElement,
    /**
     * Finds all edges originating at a specific source table or column
     */
    findEdgesFromSource,
    /**
     * Finds all edges targeting a specific source table or column
     */
    findEdgesToTarget,
    /**
     * Finds all elements connected via the graph to a focused element
     */
    findConnectedElements
  };
};
