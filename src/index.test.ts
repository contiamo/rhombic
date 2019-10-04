import rhombic from "./";

describe("rhombic", () => {
  describe("errors", () => {
    it("should throw on bad sql", () => {
      expect(() => rhombic.parse("I'm not a sql statement")).toThrowError(
        `Lexer error:\n - unexpected character: ->'<- at offset: 1, skipped 1 characters.`
      );
    });
  });

  describe("hasFrom", () => {
    it("should return true if the statement has FROM", () => {
      const hasFrom = rhombic.parse("SELECT * FROM my_table").hasFrom();

      expect(hasFrom).toBe(true);
    });
    it("should return false if the statement doesn't have FROM", () => {
      const hasFrom = rhombic.parse("SELECT 'hello'").hasFrom();

      expect(hasFrom).toBe(false);
    });
    it("should return false if the statement doesn't have FROM (sneaky case)", () => {
      const hasFrom = rhombic.parse("SELECT 'from hello'").hasFrom();

      expect(hasFrom).toBe(false);
    });
  });

  describe("hasTablePrimary", () => {
    it("should return true if the table is part of the query", () => {
      const hasTablePrimary = rhombic
        .parse("SELECT * FROM plop")
        .hasTablePrimary("plop");

      expect(hasTablePrimary).toBe(true);
    });

    it("should return false if the table is not part of the query", () => {
      const hasTablePrimary = rhombic
        .parse("SELECT * FROM plop")
        .hasTablePrimary("nope");

      expect(hasTablePrimary).toBe(false);
    });

    it("should deal with two level table name", () => {
      const hasTablePrimary = rhombic
        .parse("SELECT * FROM schemaName.tableName")
        .hasTablePrimary("schemaName.tableName");

      expect(hasTablePrimary).toBe(true);
    });

    it("should deal with two level table name (escaped)", () => {
      const hasTablePrimary = rhombic
        .parse('SELECT * FROM "schemaName"."tableName"')
        .hasTablePrimary("schemaName.tableName");

      expect(hasTablePrimary).toBe(true);
    });

    it("should deal with two level table name (escaped bis)", () => {
      const hasTablePrimary = rhombic
        .parse('SELECT * FROM "schemaName"."tableName"')
        .hasTablePrimary('"schemaName".tableName');

      expect(hasTablePrimary).toBe(true);
    });

    it("should deal with case sensitivity", () => {
      const hasTablePrimary = rhombic
        .parse("SELECT * FROM foo.BAR")
        .hasTablePrimary("foo.bar");

      expect(hasTablePrimary).toBe(false);
    });
  });

  describe("addProjectionItem", () => {
    it("should add `column02` to the project items", () => {
      const query = rhombic
        .parse("SELECT column01 FROM my_table")
        .addProjectionItem("column02")
        .toString();

      expect(query).toEqual("SELECT column01, column02 FROM my_table");
    });
    it("should add `column03` to the project items", () => {
      const query = rhombic
        .parse("SELECT column01, column02 FROM my_table")
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual(
        "SELECT column01, column02, column03 FROM my_table"
      );
    });
    it("should add `column03` to the project items (integer)", () => {
      const query = rhombic
        .parse("SELECT 2, 3 FROM my_table")
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual("SELECT 2, 3, column03 FROM my_table");
    });
    it("should add `column03` to the project items (asterisk)", () => {
      const query = rhombic
        .parse("SELECT * FROM my_table")
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual("SELECT column03 FROM my_table");
    });
    it("should add `column03` to the project items (asterisk without autoRemove)", () => {
      const query = rhombic
        .parse("SELECT * FROM my_table")
        .addProjectionItem("column03", { removeAsterisk: false })
        .toString();

      expect(query).toEqual("SELECT *, column03 FROM my_table");
    });
    it("should remove the asterisk in a multiline statement", () => {
      const query = rhombic
        .parse(
          `
        SELECT
          *
        FROM
          my_table`
        )
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual(`
        SELECT
          column03
        FROM
          my_table`);
    });
    it("should remove the asterisk in a multiline statement (with already one column)", () => {
      const query = rhombic
        .parse(
          `
        SELECT
          *,
          column01
        FROM
          my_table`
        )
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual(`
        SELECT
          column01,
          column03
        FROM
          my_table`);
    });
    it("should deal with alias", () => {
      const query = rhombic
        .parse("SELECT column01 AS toto FROM my_table")
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual("SELECT column01 AS toto, column03 FROM my_table");
    });
    it("should deal with a multiline statement", () => {
      const query = rhombic
        .parse(
          `
        SELECT
          column01,
          column02
        FROM my_table`
        )
        .addProjectionItem("column03")
        .toString();

      expect(query).toEqual(
        `
        SELECT
          column01,
          column02,
          column03
        FROM my_table`
      );
    });
    it("should deal with inserted quoted value", () => {
      const query = rhombic
        .parse("SELECT column01 AS toto FROM my_table")
        .addProjectionItem('"column03"')
        .toString();

      expect(query).toEqual(
        'SELECT column01 AS toto, "column03" FROM my_table'
      );
    });
    it("should escape reserved keyword", () => {
      const query = rhombic
        .parse("SELECT column01 AS toto FROM my_table")
        .addProjectionItem("day")
        .toString();

      expect(query).toEqual('SELECT column01 AS toto, "day" FROM my_table');
    });
    it("should override only one option", () => {
      const query = rhombic
        .parse("SELECT *, column01 AS toto FROM my_table")
        .addProjectionItem("day", { removeAsterisk: false })
        .toString();

      expect(query).toEqual('SELECT *, column01 AS toto, "day" FROM my_table');
    });
  });

  describe("updateProjectionItem", () => {
    it("should rename a simple statement", () => {
      const query = rhombic
        .parse("SELECT column01 FROM my_table")
        .updateProjectionItem({
          columns: ["column01"],
          index: 0,
          value: "column01 AS my_column"
        })
        .toString();

      expect(query).toEqual("SELECT column01 AS my_column FROM my_table");
    });

    it("should rename a simple statement (with function)", () => {
      const query = rhombic
        .parse("SELECT column01 FROM my_table")
        .updateProjectionItem({
          columns: ["column01"],
          index: 0,
          value: "avg(column01)"
        })
        .toString();

      expect(query).toEqual("SELECT avg(column01) FROM my_table");
    });

    it("should expanded a star if needed", () => {
      const query = rhombic
        .parse("SELECT * FROM my_table")
        .updateProjectionItem({
          columns: ["column01", "column02", "column03", "column04"],
          index: 1,
          value: "column02 AS my_column"
        })
        .toString();

      expect(query).toEqual(
        "SELECT column01, column02 AS my_column, column03, column04 FROM my_table"
      );
    });

    it("should expanded a star with side projections", () => {
      const query = rhombic
        .parse("SELECT column01, *, column04 FROM my_table")
        .updateProjectionItem({
          columns: ["column01", "column02", "column03", "column04"],
          index: 1,
          value: "column02 AS my_column"
        })
        .toString();

      expect(query).toEqual(
        "SELECT column01, column02 AS my_column, column03, column04 FROM my_table"
      );
    });

    it("should preserved previous rename", () => {
      const query = rhombic
        .parse("SELECT column01 AS my_column01, *, column04 FROM my_table")
        .updateProjectionItem({
          columns: ["my_column01", "column02", "column03", "column04"],
          index: 1,
          value: "column02 AS my_column02"
        })
        .toString();

      expect(query).toEqual(
        "SELECT column01 AS my_column01, column02 AS my_column02, column03, column04 FROM my_table"
      );
    });

    it("should deal with multiple stars query", () => {
      const query = rhombic
        .parse("SELECT column01 AS my_column01, *, column04, * FROM my_table")
        .updateProjectionItem({
          columns: [
            "my_column01",
            // *
            "column01",
            "column02",
            "column03",
            "column04",
            // column 04
            "column040",
            // *
            "column010",
            "column020",
            "column030",
            "column041"
          ],
          index: 3,
          value: "column03 AS oh_yeah"
        })
        .toString();

      expect(query).toEqual(
        "SELECT column01 AS my_column01, column01, column02, column03 AS oh_yeah, column04, column04, * FROM my_table"
      );
    });
  });

  describe("getProjectionItem", () => {
    it("should give projection item of a simple statement", () => {
      const projectionItem = rhombic
        .parse("SELECT hello FROM world")
        .getProjectionItem({ columns: ["hello"], index: 0 });

      expect(projectionItem).toEqual({
        expression: "hello"
      });
    });

    it("should give projection item of a renamed projection", () => {
      const projectionItem = rhombic
        .parse(
          "SELECT mischa, slava, tejas as chicken, imogen, fabien FROM best_team_ever"
        )
        .getProjectionItem({
          columns: ["mischa", "slava", "chicken", "imogen", "fabien"],
          index: 2
        });

      expect(projectionItem).toEqual({
        expression: "tejas",
        alias: "chicken"
      });
    });

    it("should give projection item of a renamed projection with function", () => {
      const projectionItem = rhombic
        .parse(
          "SELECT mischa, slava, avg(tejas) as chicken, imogen, fabien FROM best_team_ever"
        )
        .getProjectionItem({
          columns: ["mischa", "slava", "chicken", "imogen", "fabien"],
          index: 2
        });

      expect(projectionItem).toEqual({
        expression: "avg(tejas)",
        alias: "chicken"
      });
    });

    it("should preserve formatting of the expression", () => {
      const projectionItem = rhombic
        .parse(
          "SELECT mischa, slava, avg( tejas ) as chicken, imogen, fabien FROM best_team_ever"
        )
        .getProjectionItem({
          columns: ["mischa", "slava", "chicken", "imogen", "fabien"],
          index: 2
        });

      expect(projectionItem).toEqual({
        expression: "avg( tejas )",
        alias: "chicken"
      });
    });

    it("should return information from columns if the index is on the asterisk", () => {
      const projectionItem = rhombic
        .parse("SELECT * FROM best_team_ever")
        .getProjectionItem({
          columns: ["mischa", "slava", "tejas", "imogen", "fabien"],
          index: 2
        });

      expect(projectionItem).toEqual({
        expression: "tejas"
      });
    });

    it("should still give the original expression with asterisk on the query", () => {
      const projectionItem = rhombic
        .parse("SELECT avg(mischa), * FROM best_team_ever")
        .getProjectionItem({
          columns: ["EXPR$0", "mischa", "slava", "tejas", "imogen", "fabien"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "avg(mischa)"
      });
    });

    it("should deal with duplicate columns", () => {
      const projectionItem = rhombic
        .parse("SELECT mischa, * FROM best_team_ever")
        .getProjectionItem({
          columns: ["mischa", "mischa0", "slava", "tejas", "imogen", "fabien"],
          index: 1
        });

      expect(projectionItem).toEqual({
        expression: "mischa"
      });
    });

    it("should deal with duplicate columns (tricky)", () => {
      const projectionItem = rhombic
        .parse("SELECT address, address1, * FROM foodmart.customer")
        .getProjectionItem({
          columns: [
            "address",
            "address1",
            "address0",
            "address10",
            "address2",
            "lname",
            "fname"
          ],
          index: 3
        });

      expect(projectionItem).toEqual({
        expression: "address1"
      });
    });
  });
});
