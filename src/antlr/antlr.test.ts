import antlr from ".";
import { Edge, Lineage, Table } from "../Lineage";
import * as fs from "fs";
import { TablePrimary } from "..";

const TESTS_PATH = `${__dirname}/lineage.tests`;

type ColumnId = string;
const columnsMapping: { [tableId: string]: ColumnId[] } = {
  account: ["account_type", "account_id", "account_description", "account_parent", "account_rollup"],
  employee: [
    "birth_date",
    "department_id",
    "education_level",
    "employee_id",
    "end_date",
    "first_name",
    "full_name",
    "gender",
    "hire_date",
    "last_name",
    "management_role",
    "marital_status",
    "position_id",
    "position_title",
    "salary",
    "store_id",
    "supervisor_id"
  ],
  salary: [
    "currency_id",
    "department_id",
    "employee_id",
    "overtime_paid",
    "pay_date",
    "salary_paid",
    "vacation_accrued",
    "vacation_used"
  ]
};

const getTable = (table: TablePrimary) => {
  if (!(table.tableName in columnsMapping)) {
    return undefined;
  }

  const columnNames = columnsMapping[table.tableName] || [];
  const columns = columnNames.map(columnId => ({
    id: columnId,
    data: { id: columnId, tableId: table.tableName }
  }));
  return {
    table: { id: table.tableName, data: { id: table.tableName } },
    columns
  };
};

describe("antlr", () => {
  it("should build parse tree", () => {
    const sql = "select * from emp";
    const parsed = antlr.parse(sql);
    expect(parsed.tree.toStringTree()).toBe(
      "(select*fromemp (select*fromemp (select*fromemp (select*fromemp (select*fromemp (select* select (* (* (* (* (* (* *))))))) (fromemp from (emp (emp (emp (emp (emp (emp emp)) )) )))))) ))"
    );
  });

  function cmpLineage(
    a: Edge | Table<{ id: string }, { id: string; tableId: string }>,
    b: Edge | Table<{ id: string }, { id: string; tableId: string }>
  ): number {
    switch (a.type) {
      case "edge":
        switch (b.type) {
          case "edge":
            return 0;
          case "table":
            return -1;
        }
        break;
      case "table":
        switch (b.type) {
          case "edge":
            return 1;
            break;
          case "table":
            return a.id.localeCompare(b.id);
        }
        break;
    }
  }

  type TestCase = {
    sql: string | Array<string>;
    data: Lineage<{ id: string }, { id: string; tableId: string }>;
    only?: boolean;
    debug?: boolean; // output in debug.json
    mergedLeaves?: boolean;
    options?: {
      positionalRefsEnabled?: boolean;
    };
  };

  fs.readdirSync(TESTS_PATH)
    .filter(s => s.endsWith(".json"))
    .forEach(file => {
      const raw = fs.readFileSync(`${TESTS_PATH}/${file}`);
      const name = file.slice(0, -".json".length);
      const testCase: TestCase = JSON.parse(raw.toString());
      const { data, only, sql, debug, mergedLeaves, options } = testCase;
      const sqlStr = sql instanceof Array ? sql.join("\n") : sql;
      (only ? it.only : it)(name, () => {
        const lineage = antlr
          .parse(sqlStr, { doubleQuotedIdentifier: true })
          .getLineage(getTable, mergedLeaves, options);
        if (debug) {
          const previous = fs.existsSync("debug.json") ? fs.readFileSync("debug.json", "utf-8") : "";
          const next = JSON.stringify(lineage, null, 2);

          if (previous !== next) {
            fs.writeFileSync("debug.json", next);
          }
        }

        data.sort(cmpLineage);
        lineage.sort(cmpLineage);

        expect(lineage).toEqual(data);
      });
    });
});
