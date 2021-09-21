import { antlr } from ".";
import { LineageHelper } from "./LineageHelper";

describe("LineageHelper", () => {
  const sql =
    "select foo from (select foo, uhu, bar from (select concat(buzz, foo) as foo, foo as foo2, zoo, uhu, bar from sales) t1 where zoo = '') t2 order by bar";
  const parsed = antlr.parse(sql);
  const helper = LineageHelper(parsed.getLineage());

  describe("findElement", () => {
    it("finds a table that is in the lineage", () => {
      expect(helper.findElement({ type: "table", id: "result_2" })).toMatchObject({
        type: "table",
        id: "result_2",
        label: "t2"
      });
    });

    it("finds a column that is in the lineage", () => {
      expect(helper.findElement({ type: "column", tableId: "result_2", column: { id: "column_3" } })).toMatchObject({
        type: "column",
        tableId: "result_2",
        column: {
          id: "column_3",
          label: "bar"
        }
      });
    });
  });

  describe("findEdgesFromSource", () => {
    it("finds edges from a source column", () => {
      expect(helper.findEdgesFromSource({ type: "column", tableId: "result_4", column: { id: "column_2" } })).toEqual([
        {
          edgeType: "select",
          source: { columnId: "column_2", tableId: "result_4" },
          target: { columnId: "column_1", tableId: "result_3" },
          type: "edge"
        },
        {
          edgeType: "select",
          source: { columnId: "column_2", tableId: "result_4" },
          target: { columnId: "column_2", tableId: "result_3" },
          type: "edge"
        }
      ]);
    });
  });

  describe("findEdgesToTarget", () => {
    it("finds edges to a target column", () => {
      expect(helper.findEdgesToTarget({ type: "column", tableId: "result_3", column: { id: "column_1" } })).toEqual([
        {
          edgeType: "select",
          source: { columnId: "column_1", tableId: "result_4" },
          target: { columnId: "column_1", tableId: "result_3" },
          type: "edge"
        },
        {
          edgeType: "select",
          source: { columnId: "column_2", tableId: "result_4" },
          target: { columnId: "column_1", tableId: "result_3" },
          type: "edge"
        }
      ]);
    });
    it("finds edges to a target column in a table that also is a target itself", () => {
      expect(helper.findEdgesToTarget({ type: "column", tableId: "result_1", column: { id: "column_1" } })).toEqual([
        {
          edgeType: "select",
          source: { tableId: "result_2", columnId: "column_1" },
          target: { tableId: "result_1", columnId: "column_1" },
          type: "edge"
        }
      ]);
    });
    it("finds edges to a target table", () => {
      expect(helper.findEdgesToTarget({ type: "table", id: "result_1" })).toEqual([
        {
          edgeType: "order by",
          source: { columnId: "column_3", tableId: "result_2" },
          target: { tableId: "result_1", columnId: undefined },
          type: "edge"
        }
      ]);
    });
  });

  describe("connectedElements", () => {
    it("returns elements connected through the graph to a focused table", () => {
      expect(helper.findConnectedElements({ type: "table", id: "result_1" }).elements).toEqual({
        columns: [
          {
            column: {
              data: undefined,
              id: "column_3",
              isAssumed: undefined,
              label: "bar",
              range: { endColumn: 37, endLine: 1, startColumn: 34, startLine: 1 }
            },
            tableId: "result_2",
            type: "column"
          },
          {
            column: {
              data: undefined,
              id: "column_5",
              isAssumed: undefined,
              label: "bar",
              range: { endColumn: 103, endLine: 1, startColumn: 100, startLine: 1 }
            },
            tableId: "result_3",
            type: "column"
          },
          {
            column: {
              data: undefined,
              id: "column_5",
              isAssumed: true,
              label: "bar",
              range: { endColumn: 103, endLine: 1, startColumn: 100, startLine: 1 }
            },
            tableId: "result_4",
            type: "column"
          }
        ],
        edges: [
          {
            edgeType: "order by",
            source: { columnId: "column_3", tableId: "result_2" },
            target: { columnId: undefined, tableId: "result_1" },
            type: "edge"
          },
          {
            edgeType: "select",
            source: { columnId: "column_5", tableId: "result_3" },
            target: { columnId: "column_3", tableId: "result_2" },
            type: "edge"
          },
          {
            edgeType: "select",
            source: { columnId: "column_5", tableId: "result_4" },
            target: { columnId: "column_5", tableId: "result_3" },
            type: "edge"
          }
        ],
        tables: [
          {
            columns: [
              {
                data: undefined,
                id: "column_1",
                isAssumed: undefined,
                label: "foo",
                range: { endColumn: 10, endLine: 1, startColumn: 7, startLine: 1 }
              }
            ],
            data: undefined,
            id: "result_1",
            isSourceOnly: undefined,
            isTargetOnly: true,
            label: "[final result]",
            range: { endColumn: 150, endLine: 1, startColumn: 0, startLine: 1 },
            type: "table"
          }
        ]
      });
    });

    it("returns elements connected through the graph to a focused column", () => {
      expect(
        helper.findConnectedElements({ type: "column", tableId: "result_2", column: { id: "column_3" } }).elements
      ).toEqual({
        columns: [
          {
            column: {
              data: undefined,
              id: "column_3",
              isAssumed: undefined,
              label: "bar",
              range: { endColumn: 37, endLine: 1, startColumn: 34, startLine: 1 }
            },
            tableId: "result_2",
            type: "column"
          },
          {
            column: {
              data: undefined,
              id: "column_5",
              isAssumed: undefined,
              label: "bar",
              range: { endColumn: 103, endLine: 1, startColumn: 100, startLine: 1 }
            },
            tableId: "result_3",
            type: "column"
          },
          {
            column: {
              data: undefined,
              id: "column_5",
              isAssumed: true,
              label: "bar",
              range: { endColumn: 103, endLine: 1, startColumn: 100, startLine: 1 }
            },
            tableId: "result_4",
            type: "column"
          }
        ],
        edges: [
          {
            edgeType: "select",
            source: { columnId: "column_5", tableId: "result_3" },
            target: { columnId: "column_3", tableId: "result_2" },
            type: "edge"
          },
          {
            edgeType: "select",
            source: { columnId: "column_5", tableId: "result_4" },
            target: { columnId: "column_5", tableId: "result_3" },
            type: "edge"
          },
          {
            edgeType: "order by",
            source: { columnId: "column_3", tableId: "result_2" },
            target: { columnId: undefined, tableId: "result_1" },
            type: "edge"
          }
        ],
        tables: [
          {
            columns: [
              {
                data: undefined,
                id: "column_1",
                isAssumed: undefined,
                label: "foo",
                range: { endColumn: 10, endLine: 1, startColumn: 7, startLine: 1 }
              }
            ],
            data: undefined,
            id: "result_1",
            isSourceOnly: undefined,
            isTargetOnly: true,
            label: "[final result]",
            range: { endColumn: 150, endLine: 1, startColumn: 0, startLine: 1 },
            type: "table"
          }
        ]
      });
    });

    it("returns elements connected through the graph to a focused edge", () => {
      expect(
        helper.findConnectedElements({
          type: "edge",
          source: { tableId: "result_3", columnId: "column_3" },
          target: { tableId: "result_2" },
          edgeType: "where"
        }).elements
      ).toEqual({
        columns: [
          {
            column: {
              data: undefined,
              id: "column_3",
              isAssumed: undefined,
              label: "zoo",
              range: { endColumn: 93, endLine: 1, startColumn: 90, startLine: 1 }
            },
            tableId: "result_3",
            type: "column"
          },
          {
            column: {
              data: undefined,
              id: "column_3",
              isAssumed: true,
              label: "zoo",
              range: { endColumn: 93, endLine: 1, startColumn: 90, startLine: 1 }
            },
            tableId: "result_4",
            type: "column"
          }
        ],
        edges: [
          {
            edgeType: "where",
            source: { columnId: "column_3", tableId: "result_3" },
            target: { columnId: undefined, tableId: "result_2" },
            type: "edge"
          },
          {
            edgeType: "select",
            source: { columnId: "column_3", tableId: "result_4" },
            target: { columnId: "column_3", tableId: "result_3" },
            type: "edge"
          }
        ],
        tables: [
          {
            columns: [
              {
                data: undefined,
                id: "column_1",
                isAssumed: undefined,
                label: "foo",
                range: { endColumn: 27, endLine: 1, startColumn: 24, startLine: 1 }
              },
              {
                data: undefined,
                id: "column_2",
                isAssumed: undefined,
                label: "uhu",
                range: { endColumn: 32, endLine: 1, startColumn: 29, startLine: 1 }
              },
              {
                data: undefined,
                id: "column_3",
                isAssumed: undefined,
                label: "bar",
                range: { endColumn: 37, endLine: 1, startColumn: 34, startLine: 1 }
              }
            ],
            data: undefined,
            id: "result_2",
            isSourceOnly: undefined,
            label: "t2",
            range: { endColumn: 133, endLine: 1, startColumn: 17, startLine: 1 },
            type: "table"
          }
        ]
      });
    });
  });

  describe("#findElement within connected elements", () => {
    const connectedElements = helper.findConnectedElements({
      type: "edge",
      source: { tableId: "result_3", columnId: "column_3" },
      target: { tableId: "result_2" },
      edgeType: "where"
    });

    it("Finds a table in the connected elements", () => {
      expect(connectedElements.findElement({ type: "table", id: "result_2" })).toMatchObject({
        type: "table",
        id: "result_2",
        label: "t2"
      });
    });
    it("Finds a column in the connected elements", () => {
      expect(
        connectedElements.findElement({ type: "column", tableId: "result_3", column: { id: "column_3" } })
      ).toMatchObject({
        type: "column",
        tableId: "result_3",
        column: { id: "column_3" }
      });
    });
    it("Finds an edge in the connected elements", () => {
      expect(
        connectedElements.findElement({
          type: "edge",
          edgeType: "where",
          source: { tableId: "result_3", columnId: "column_3" },
          target: { tableId: "result_2" }
        })
      ).toMatchObject({
        type: "edge",
        edgeType: "where",
        source: { tableId: "result_3", columnId: "column_3" },
        target: { tableId: "result_2" }
      });
    });
  });
});
