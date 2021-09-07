import { antlr } from "..";

describe("ExtractionVisitor", () => {
  it("should extract tables in SELECT", () => {
    const sql = "select * from t1, s1.t1, s2.t1, (select * from c1.s2.t2, s3.t3, t4) as sq";
    const tree = antlr.parse(sql);
    expect(tree.getUsedTables()).toEqual({
      references: [
        {
          tableName: "t1"
        },
        {
          schemaName: "s1",
          tableName: "t1"
        },
        {
          schemaName: "s2",
          tableName: "t1"
        },
        {
          catalogName: "c1",
          schemaName: "s2",
          tableName: "t2"
        },
        {
          schemaName: "s3",
          tableName: "t3"
        },
        {
          tableName: "t4"
        }
      ],
      incomplete: []
    });
  });

  it("should extrace incomplete references in SELECT", () => {
    const sqlWithSchema = "select * from s., table1";
    const treeWithSchema = antlr.parse(sqlWithSchema, { cursorPosition: { lineNumber: 1, column: 17 } });
    expect(treeWithSchema.getUsedTables()).toEqual({
      references: [{ tableName: "table1" }],
      incomplete: [{ references: ["s"] }]
    });

    const sqlWithCatalog = "select * from table1, c.s.";
    const treeWithCatalog = antlr.parse(sqlWithCatalog, { cursorPosition: { lineNumber: 1, column: 27 } });
    expect(treeWithCatalog.getUsedTables()).toEqual({
      references: [{ tableName: "table1" }],
      incomplete: [{ references: ["c", "s"] }]
    });
  });
});
