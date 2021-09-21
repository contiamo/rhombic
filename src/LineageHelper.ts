import { Edge, EdgeType, isTable, isEdge, Lineage, Table, Column, LineageElement } from "./Lineage";

interface TableId {
  type: "table";
  tableId: string;
}

interface ColumnId {
  type: "column";
  tableId: string;
  columnId: string;
}

interface EdgeId {
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

/**
 * The element - table, column, edge - that is in focus
 */
export type ElementId = TableId | ColumnId | EdgeId;

export type MatchedElement<TableData, ColumnData> = LineageElement<TableData, ColumnData> | ColumnReference<ColumnData>;

export interface ColumnReference<ColumnData> {
  type: "column";
  tableId: string;
  column: Column<ColumnData>;
}

export const toElementId = <TableData, ColumnData>(element: MatchedElement<TableData, ColumnData>): ElementId => {
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

const edgeFinder = (edges: Edge[]) => (edgeId: EdgeId): Edge | undefined =>
  edges.find(
    element =>
      element.source.tableId === edgeId.source.tableId &&
      element.source.columnId === edgeId.source.columnId &&
      element.target.tableId === edgeId.target.tableId &&
      element.target.columnId === edgeId.target.columnId &&
      element.edgeType === edgeId.edgeType
  );

const tableFinder = <TableData, ColumnData>(tables: Table<TableData, ColumnData>[]) => (
  tableId: TableId
): Table<TableData, ColumnData> | undefined => tables.find(element => element.id === tableId.tableId);

const columnFinder = <TableData, ColumnData>(tables: Table<TableData, ColumnData>[]) => (
  columnId: ColumnId
): ColumnReference<ColumnData> | undefined => {
  const table = tableFinder(tables)({ type: "table", tableId: columnId.tableId });
  if (!table) return;
  const column = table.columns.find(column => column.id === columnId.columnId);
  if (!column) return;
  return {
    type: "column",
    tableId: table.id,
    column
  };
};

const edgesBySourceFinder = (edges: Edge[]) => (elementId: TableId | ColumnId) =>
  edges.filter(
    element =>
      element.source.tableId === elementId.tableId &&
      ((elementId.type === "column" && element.source.columnId === elementId.columnId) ||
        (elementId.type === "table" && element.source.columnId === undefined))
  );

const edgesByTargetFinder = (edges: Edge[]) => (elementId: TableId | ColumnId) =>
  edges.filter(
    element =>
      element.target.tableId === elementId.tableId &&
      ((elementId.type === "column" && element.target.columnId === elementId.columnId) ||
        (elementId.type === "table" && element.target.columnId === undefined))
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
  const findElement = (elementId: ElementId) =>
    elementId.type === "table"
      ? findTable(elementId)
      : elementId.type === "column"
      ? findColumn(elementId)
      : findEdge(elementId);
  const findEdgesFromSource = edgesBySourceFinder(edges);
  const findEdgesToTarget = edgesByTargetFinder(edges);

  const walkUp = (elementId: ElementId) => {
    if (elementId.type === "table" || elementId.type === "column") {
      return findEdgesToTarget(elementId);
    }
    // it's and edge
    const tableOrColumn =
      elementId.source.columnId !== undefined
        ? findElement({ type: "column", tableId: elementId.source.tableId, columnId: elementId.source.columnId })
        : findElement({ type: "table", tableId: elementId.source.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  const walkDown = (elementId: ElementId) => {
    if (elementId.type === "table" || elementId.type === "column") {
      return findEdgesFromSource(elementId);
    }
    // it's and edge
    const tableOrColumn =
      elementId.target.columnId !== undefined
        ? findElement({ type: "column", tableId: elementId.target.tableId, columnId: elementId.target.columnId })
        : findElement({ type: "table", tableId: elementId.target.tableId });
    return tableOrColumn === undefined ? [] : [tableOrColumn];
  };

  // Texas Ranger
  const walker = (
    elementId: ElementId,
    direction: Direction,
    eachElement: (element: MatchedElement<TableData, ColumnData>) => void
  ) => {
    (direction === "up" ? walkUp : walkDown)(elementId).forEach(element => {
      eachElement(element);
      walker(toElementId(element), direction, eachElement);
    });
  };

  const findConnectedElements = (elementId: ElementId) => {
    // Check that the given element exists and include it in the connected elements
    const element = findElement(elementId);
    if (!element) throw Error(`Element not found in lineage - ${JSON.stringify(elementId)}`);
    const elements: MatchedElement<TableData, ColumnData>[] = [element];
    const collect = (element: MatchedElement<TableData, ColumnData>) => elements.push(element);
    walker(elementId, "up", collect);
    walker(elementId, "down", collect);
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
