import { antlr } from "..";
import { LineageHelper } from "./LineageHelper";

describe("LineageHelper", () => {
  const sql =
    "select foo from (select foo, uhu, bar from (select concat(buzz, foo) as foo, foo as foo2, zoo, uhu, bar from sales) t1 where zoo = '') t2 order by bar";
  const parsed = antlr.parse(sql);
  const helper = LineageHelper(parsed.getLineage());

  describe("findElement", () => {
    it("finds a table that is in the lineage", () => {
      expect(helper.findElement({ type: "table", tableId: "result_2" })).toMatchObject({
        type: "table",
        id: "result_2",
        label: "t2"
      });
    });

    it("finds a column that is in the lineage", () => {
      expect(helper.findElement({ type: "column", tableId: "result_2", columnId: "column_3" })).toMatchObject({
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
      expect(helper.findEdgesFromSource({ type: "column", tableId: "result_4", columnId: "column_2" })).toEqual([
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
      expect(helper.findEdgesToTarget({ type: "column", tableId: "result_3", columnId: "column_1" })).toEqual([
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
  });

  describe("connectedElements", () => {
    it("returns elements connected through the graph to a focused column", () => {
      expect(helper.findConnectedElements({ type: "column", tableId: "result_2", columnId: "column_3" })).toEqual([
        {
          type: "column",
          tableId: "result_2",
          column: { id: "column_3", label: "bar", range: { startLine: 1, endLine: 1, startColumn: 34, endColumn: 37 } }
        },
        {
          type: "edge",
          edgeType: "select",
          source: { tableId: "result_3", columnId: "column_5" },
          target: { tableId: "result_2", columnId: "column_3" }
        },
        {
          type: "column",
          tableId: "result_3",
          column: {
            id: "column_5",
            label: "bar",
            range: { startLine: 1, endLine: 1, startColumn: 100, endColumn: 103 }
          }
        },
        {
          type: "edge",
          edgeType: "select",
          source: { tableId: "result_4", columnId: "column_5" },
          target: { tableId: "result_3", columnId: "column_5" }
        },
        {
          type: "column",
          tableId: "result_4",
          column: {
            id: "column_5",
            label: "bar",
            range: { startLine: 1, endLine: 1, startColumn: 100, endColumn: 103 },
            isAssumed: true
          }
        },
        {
          type: "edge",
          edgeType: "order by",
          source: { tableId: "result_2", columnId: "column_3" },
          target: { tableId: "result_1" }
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          range: { startLine: 1, endLine: 1, startColumn: 0, endColumn: 150 },
          columns: [
            { id: "column_1", label: "foo", range: { startLine: 1, endLine: 1, startColumn: 7, endColumn: 10 } }
          ],
          isTargetOnly: true
        }
      ]);
    });
  });

  xit("returns elements connected through the graph to a focused table", () => {
    console.log(JSON.stringify(helper.findConnectedElements({ type: "table", tableId: "result_1" })));
    expect(helper.findConnectedElements({ type: "table", tableId: "result_1" })).toEqual([]);
  });

  xit("returns elements connected through the graph to a focused edge", () => {
    console.log(JSON.stringify(helper.findConnectedElements({ type: "table", tableId: "result_1" })));
    expect(
      helper.findConnectedElements({
        type: "edge",
        source: { tableId: "result_1", columnId: "column_1" },
        target: { tableId: "result_2", columnId: "column_1" }
      })
    ).toEqual([]);
  });
});
