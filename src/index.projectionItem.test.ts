import rhombic from "./";

describe("projectionItem", () => {
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

    it("should deal with reserved keywords in columns", () => {
      const query = rhombic
        .parse("SELECT * FROM my_table")
        .updateProjectionItem({
          columns: ["DATE", "column02", "column03", "column04"],
          index: 1,
          value: "column02 AS my_column"
        })
        .toString();

      expect(query).toEqual(
        'SELECT "DATE", column02 AS my_column, column03, column04 FROM my_table'
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

    it("should update the ORDER BY statement if related to the projectionItem", () => {
      const query = rhombic
        .parse(
          "SELECT column01 AS my_column01 FROM my_table ORDER BY my_column01"
        )
        .updateProjectionItem({
          columns: ["my_column01"],
          index: 0,
          value: "column01 AS a_new_name"
        })
        .toString();

      expect(query).toEqual(
        "SELECT column01 AS a_new_name FROM my_table ORDER BY a_new_name"
      );
    });

    it("should rename a projection that already have an alias", () => {
      const query = rhombic
        .parse(
          `SELECT
        ACCOUNT_ID,
        ACCOUNT_PARENT AS felix,
        ACCOUNT_DESCRIPTION,
        ACCOUNT_TYPE,
        ACCOUNT_ROLLUP,
        CUSTOM_MEMBERS,
        *
      FROM
        "foodmart"."ACCOUNT"
        `
        )
        .updateProjectionItem({
          columns: [
            "ACCOUNT_ID",
            "felix",
            "ACCOUNT_DESCRIPTION",
            "ACCOUNT_TYPE",
            "ACCOUNT_ROLLUP",
            "CUSTOM_MEMBERS",
            "ACCOUNT_ID0",
            "ACCOUNT_PARENT",
            "ACCOUNT_DESCRIPTION0",
            "ACCOUNT_TYPE0",
            "ACCOUNT_ROLLUP0",
            "CUSTOM_MEMBERS0"
          ],
          index: 1,
          value: "ACCOUNT_PARENT AS felix2"
        })
        .toString();

      expect(query).toEqual(`SELECT
        ACCOUNT_ID,
        ACCOUNT_PARENT AS felix2,
        ACCOUNT_DESCRIPTION,
        ACCOUNT_TYPE,
        ACCOUNT_ROLLUP,
        CUSTOM_MEMBERS,
        *
      FROM
        "foodmart"."ACCOUNT"
        `);
    });
  });

  describe("removeProjectionItem", () => {
    it("should remove a simple projection item", () => {
      const query = rhombic
        .parse("SELECT a, b, c from d")
        .removeProjectionItem({
          columns: ["a", "b", "c"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT b, c from d");
    });

    it("should remove a simple projection item (second item)", () => {
      const query = rhombic
        .parse("SELECT a, b, c from d")
        .removeProjectionItem({
          columns: ["a", "b", "c"],
          index: 1
        })
        .toString();

      expect(query).toEqual("SELECT a, c from d");
    });

    it("should remove a simple projection item (last item)", () => {
      const query = rhombic
        .parse("SELECT a, b, c from d")
        .removeProjectionItem({
          columns: ["a", "b", "c"],
          index: 2
        })
        .toString();

      expect(query).toEqual("SELECT a, b from d");
    });

    it("should remove a projection in asterisk", () => {
      const query = rhombic
        .parse("SELECT * from d")
        .removeProjectionItem({
          columns: ["a", "b", "c"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT b, c from d");
    });

    it("should remove a projection in asterisk with side projection", () => {
      const query = rhombic
        .parse("SELECT count(a), * from d")
        .removeProjectionItem({
          columns: ["a", "a", "b", "c"],
          index: 1
        })
        .toString();

      expect(query).toEqual("SELECT count(a), b, c from d");
    });

    it("should remove a projection without touching the asterisk if not needed", () => {
      const query = rhombic
        .parse("SELECT a, * from d")
        .removeProjectionItem({
          columns: ["a", "a", "b", "c"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT * from d");
    });

    it("should remove a function", () => {
      const query = rhombic
        .parse("SELECT count(a), b from d")
        .removeProjectionItem({
          columns: ["a", "b"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT b from d");
    });

    it("should remove a cast", () => {
      const query = rhombic
        .parse("SELECT cast(a as INT), b from d")
        .removeProjectionItem({
          columns: ["a", "b"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT b from d");
    });

    it("should remove the last element", () => {
      const query = rhombic
        .parse("SELECT a from d")
        .removeProjectionItem({
          columns: ["a"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT * from d");
    });

    it("should keep the formatting clean", () => {
      const query = rhombic
        .parse(
          `SELECT
  a,
  b,
  c
FROM
  d`
        )
        .removeProjectionItem({
          columns: ["a", "b", "c"],
          index: 1
        })
        .toString();

      expect(query).toEqual(`SELECT
  a,
  c
FROM
  d`);
    });

    it("should remove associated order by statements", () => {
      const query = rhombic
        .parse("SELECT a, b FROM c ORDER BY a, b")
        .removeProjectionItem({
          columns: ["a", "b"],
          index: 1
        })
        .toString();

      expect(query).toEqual("SELECT a FROM c ORDER BY a");
    });

    it("should remove the entire ORDER BY node if empty", () => {
      const query = rhombic
        .parse("SELECT a, b FROM c ORDER BY a")
        .removeProjectionItem({
          columns: ["a", "b"],
          index: 0
        })
        .toString();

      expect(query).toEqual("SELECT b FROM c");
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
        alias: "chicken",
        fn: {
          identifier: "avg",
          value: "tejas"
        }
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
        alias: "chicken",
        fn: {
          identifier: "avg",
          value: "tejas"
        }
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
        expression: "avg(mischa)",
        fn: {
          identifier: "avg",
          value: "mischa"
        }
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

    it("should retrieve cast information", () => {
      const projectionItem = rhombic
        .parse("SELECT CAST(address as CHAR), address1 FROM foodmart.customer")
        .getProjectionItem({
          columns: ["address", "address1"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "CAST(address as CHAR)",
        cast: {
          value: "address",
          type: "CHAR"
        }
      });
    });

    it("should retrieve cast information (with precision)", () => {
      const projectionItem = rhombic
        .parse(
          "SELECT CAST(address as CHAR(2)), address1 FROM foodmart.customer"
        )
        .getProjectionItem({
          columns: ["address", "address1"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "CAST(address as CHAR(2))",
        cast: {
          value: "address",
          type: "CHAR"
        }
      });
    });

    it("should retrieve sort information", () => {
      const projectionItem = rhombic
        .parse("SELECT foo, bar FROM foodmart.customer ORDER BY foo")
        .getProjectionItem({
          columns: ["foo", "bar"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "foo",
        sort: {
          order: "asc"
        }
      });
    });

    it("should retrieve sort information (with alias)", () => {
      const projectionItem = rhombic
        .parse(
          "SELECT foo as chocapic, bar FROM foodmart.customer ORDER BY chocapic"
        )
        .getProjectionItem({
          columns: ["chocapic", "bar"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "foo",
        alias: "chocapic",
        sort: {
          order: "asc"
        }
      });
    });

    it("should retrieve sort information from asterisk", () => {
      const projectionItem = rhombic
        .parse("SELECT * FROM foodmart.customer ORDER BY foo")
        .getProjectionItem({
          columns: ["foo", "bar"],
          index: 0
        });

      expect(projectionItem).toEqual({
        expression: "foo",
        sort: {
          order: "asc"
        }
      });
    });

    it("should not expand the sort to all columns from asterisk", () => {
      const projectionItem = rhombic
        .parse("SELECT * FROM foodmart.customer ORDER BY foo")
        .getProjectionItem({
          columns: ["foo", "bar"],
          index: 1
        });

      expect(projectionItem).toEqual({
        expression: "bar"
      });
    });
  });

  describe("getProjectionItems", () => {
    it("should retrieve all projection items metadata", () => {
      const projectionItems = rhombic
        .parse(
          "SELECT mischa, slava, tejas as chicken, imogen, fabien FROM best_team_ever"
        )
        .getProjectionItems(["mischa", "slava", "chicken", "imogen", "fabien"]);

      expect(projectionItems).toMatchInlineSnapshot(`
        Array [
          Object {
            "alias": undefined,
            "cast": undefined,
            "expression": "mischa",
            "fn": undefined,
            "sort": undefined,
          },
          Object {
            "alias": undefined,
            "cast": undefined,
            "expression": "slava",
            "fn": undefined,
            "sort": undefined,
          },
          Object {
            "alias": "chicken",
            "cast": undefined,
            "expression": "tejas",
            "fn": undefined,
            "sort": undefined,
          },
          Object {
            "alias": undefined,
            "cast": undefined,
            "expression": "imogen",
            "fn": undefined,
            "sort": undefined,
          },
          Object {
            "alias": undefined,
            "cast": undefined,
            "expression": "fabien",
            "fn": undefined,
            "sort": undefined,
          },
        ]
      `);
    });
  });
});
