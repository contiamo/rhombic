import antlr from ".";
import { Lineage } from "../Lineage";
import * as fs from "fs";
import { TablePrimary } from "..";

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

  it("should extract table primaries", () => {
    const sql = "select * from t1, s1.t1, s2.t1, (select * from c1.s2.t2, s3.t3, t4) as sq";
    const parsed = antlr.parse(sql);
    expect(parsed.getUsedTables()).toEqual([
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
    ]);
  });

  const cases: Array<{
    name: string;
    sql: string;
    data: Lineage<{ id: string }, { id: string; tableId: string }>;
    only?: boolean;
    debug?: boolean; // output in debug.json
    mergedLeaves?: boolean;
  }> = [
    {
      name: "select with aliases",
      sql:
        "select sq.account_id as account_id, e.employee_id as employee_id \n" +
        "from (select account_id as account_id, account_type as account_type from account as d) as sq, \n" +
        "   employee as e",
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account -> d",
          level: 0,
          range: {
            startLine: 2,
            endLine: 2,
            startColumn: 73,
            endColumn: 85
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "sq",
          level: 1,
          range: {
            startLine: 2,
            endLine: 2,
            startColumn: 6,
            endColumn: 85
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 13,
                endColumn: 37
              }
            },
            {
              id: "column_2",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 39,
                endColumn: 67
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_4",
          label: "employee -> e",
          level: 1,
          range: {
            startLine: 3,
            endLine: 3,
            startColumn: 3,
            endColumn: 16
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "birth_date",
              label: "birth_date",
              data: {
                id: "birth_date",
                tableId: "employee"
              }
            },
            {
              id: "department_id",
              label: "department_id",
              data: {
                id: "department_id",
                tableId: "employee"
              }
            },
            {
              id: "education_level",
              label: "education_level",
              data: {
                id: "education_level",
                tableId: "employee"
              }
            },
            {
              id: "employee_id",
              label: "employee_id",
              data: {
                id: "employee_id",
                tableId: "employee"
              }
            },
            {
              id: "end_date",
              label: "end_date",
              data: {
                id: "end_date",
                tableId: "employee"
              }
            },
            {
              id: "first_name",
              label: "first_name",
              data: {
                id: "first_name",
                tableId: "employee"
              }
            },
            {
              id: "full_name",
              label: "full_name",
              data: {
                id: "full_name",
                tableId: "employee"
              }
            },
            {
              id: "gender",
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            },
            {
              id: "hire_date",
              label: "hire_date",
              data: {
                id: "hire_date",
                tableId: "employee"
              }
            },
            {
              id: "last_name",
              label: "last_name",
              data: {
                id: "last_name",
                tableId: "employee"
              }
            },
            {
              id: "management_role",
              label: "management_role",
              data: {
                id: "management_role",
                tableId: "employee"
              }
            },
            {
              id: "marital_status",
              label: "marital_status",
              data: {
                id: "marital_status",
                tableId: "employee"
              }
            },
            {
              id: "position_id",
              label: "position_id",
              data: {
                id: "position_id",
                tableId: "employee"
              }
            },
            {
              id: "position_title",
              label: "position_title",
              data: {
                id: "position_title",
                tableId: "employee"
              }
            },
            {
              id: "salary",
              label: "salary",
              data: {
                id: "salary",
                tableId: "employee"
              }
            },
            {
              id: "store_id",
              label: "store_id",
              data: {
                id: "store_id",
                tableId: "employee"
              }
            },
            {
              id: "supervisor_id",
              label: "supervisor_id",
              data: {
                id: "supervisor_id",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 3,
            startColumn: 0,
            endColumn: 16
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 34
              }
            },
            {
              id: "column_2",
              label: "employee_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 36,
                endColumn: 64
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_4",
            columnId: "employee_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      name: "column names without aliases",
      sql:
        "select sq.account_id, account_type \n" +
        "from (select account_id, account.account_type from account) as sq, \n" +
        "   employee as e",
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 2,
            endLine: 2,
            startColumn: 51,
            endColumn: 58
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "sq",
          level: 1,
          range: {
            startLine: 2,
            endLine: 2,
            startColumn: 6,
            endColumn: 58
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 13,
                endColumn: 23
              }
            },
            {
              id: "column_2",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 25,
                endColumn: 45
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_4",
          label: "employee -> e",
          level: 1,
          range: {
            startLine: 3,
            endLine: 3,
            startColumn: 3,
            endColumn: 16
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "birth_date",
              label: "birth_date",
              data: {
                id: "birth_date",
                tableId: "employee"
              }
            },
            {
              id: "department_id",
              label: "department_id",
              data: {
                id: "department_id",
                tableId: "employee"
              }
            },
            {
              id: "education_level",
              label: "education_level",
              data: {
                id: "education_level",
                tableId: "employee"
              }
            },
            {
              id: "employee_id",
              label: "employee_id",
              data: {
                id: "employee_id",
                tableId: "employee"
              }
            },
            {
              id: "end_date",
              label: "end_date",
              data: {
                id: "end_date",
                tableId: "employee"
              }
            },
            {
              id: "first_name",
              label: "first_name",
              data: {
                id: "first_name",
                tableId: "employee"
              }
            },
            {
              id: "full_name",
              label: "full_name",
              data: {
                id: "full_name",
                tableId: "employee"
              }
            },
            {
              id: "gender",
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            },
            {
              id: "hire_date",
              label: "hire_date",
              data: {
                id: "hire_date",
                tableId: "employee"
              }
            },
            {
              id: "last_name",
              label: "last_name",
              data: {
                id: "last_name",
                tableId: "employee"
              }
            },
            {
              id: "management_role",
              label: "management_role",
              data: {
                id: "management_role",
                tableId: "employee"
              }
            },
            {
              id: "marital_status",
              label: "marital_status",
              data: {
                id: "marital_status",
                tableId: "employee"
              }
            },
            {
              id: "position_id",
              label: "position_id",
              data: {
                id: "position_id",
                tableId: "employee"
              }
            },
            {
              id: "position_title",
              label: "position_title",
              data: {
                id: "position_title",
                tableId: "employee"
              }
            },
            {
              id: "salary",
              label: "salary",
              data: {
                id: "salary",
                tableId: "employee"
              }
            },
            {
              id: "store_id",
              label: "store_id",
              data: {
                id: "store_id",
                tableId: "employee"
              }
            },
            {
              id: "supervisor_id",
              label: "supervisor_id",
              data: {
                id: "supervisor_id",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 3,
            startColumn: 0,
            endColumn: 16
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 20
              }
            },
            {
              id: "column_2",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 22,
                endColumn: 34
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_2"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      name: "PostgreSQL cast",
      sql: "select account_id::varchar from account",
      data: [
        {
          type: "table",
          id: "result_2",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 32,
            endColumn: 39
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 39
          },
          columns: [
            {
              id: "column_1",
              label: "column_1",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 26
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        }
      ]
    },
    {
      name: "double-quoted identifiers",
      sql: 'select "account_id", 1 as "one "" " ' + "from account",
      data: [
        {
          type: "table",
          id: "result_2",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 41,
            endColumn: 48
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 48
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: 'one " ',
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 21,
                endColumn: 35
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        }
      ]
    },
    {
      name: "case sensitive/insensitive identifiers",
      sql: 'select accOUNT_ID as "acc_id" from (select "account_id", ACCounT_TypE from account) as a',
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 75,
            endColumn: 82
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 36,
            endColumn: 82
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 43,
                endColumn: 55
              }
            },
            {
              id: "column_2",
              label: "ACCounT_TypE",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 57,
                endColumn: 69
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 88
          },
          columns: [
            {
              id: "column_1",
              label: "acc_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 29
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        }
      ]
    },
    {
      name: "star on subquery",
      sql: 'select * from (select "account_id", ACCounT_TypE from account) as a',
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 54,
            endColumn: 61
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 15,
            endColumn: 61
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 22,
                endColumn: 34
              }
            },
            {
              id: "column_2",
              label: "ACCounT_TypE",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 36,
                endColumn: 48
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 67
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_2",
              label: "ACCounT_TypE",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_2"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      name: "count star doesn't expand columns",
      sql: "select count(*) as c from account",
      data: [
        {
          type: "table",
          id: "result_2",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 26,
            endColumn: 33
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 33
          },
          columns: [
            {
              id: "column_1",
              label: "c",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 20
              }
            }
          ]
        }
      ]
    },
    {
      name: "star on join",
      sql: "select * from account, salary",
      data: [
        {
          type: "table",
          id: "result_2",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 14,
            endColumn: 21
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_3",
          label: "salary",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 23,
            endColumn: 29
          },
          data: {
            id: "salary"
          },
          columns: [
            {
              id: "currency_id",
              label: "currency_id",
              data: {
                id: "currency_id",
                tableId: "salary"
              }
            },
            {
              id: "department_id",
              label: "department_id",
              data: {
                id: "department_id",
                tableId: "salary"
              }
            },
            {
              id: "employee_id",
              label: "employee_id",
              data: {
                id: "employee_id",
                tableId: "salary"
              }
            },
            {
              id: "overtime_paid",
              label: "overtime_paid",
              data: {
                id: "overtime_paid",
                tableId: "salary"
              }
            },
            {
              id: "pay_date",
              label: "pay_date",
              data: {
                id: "pay_date",
                tableId: "salary"
              }
            },
            {
              id: "salary_paid",
              label: "salary_paid",
              data: {
                id: "salary_paid",
                tableId: "salary"
              }
            },
            {
              id: "vacation_accrued",
              label: "vacation_accrued",
              data: {
                id: "vacation_accrued",
                tableId: "salary"
              }
            },
            {
              id: "vacation_used",
              label: "vacation_used",
              data: {
                id: "vacation_used",
                tableId: "salary"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 29
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_3",
              label: "account_description",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_4",
              label: "account_parent",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_5",
              label: "account_rollup",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_6",
              label: "currency_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_7",
              label: "department_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_8",
              label: "employee_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_9",
              label: "overtime_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_10",
              label: "pay_date",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_11",
              label: "salary_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_12",
              label: "vacation_accrued",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            },
            {
              id: "column_13",
              label: "vacation_used",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 8
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_type"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_description"
          },
          target: {
            tableId: "result_1",
            columnId: "column_3"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_parent"
          },
          target: {
            tableId: "result_1",
            columnId: "column_4"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "account_rollup"
          },
          target: {
            tableId: "result_1",
            columnId: "column_5"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "currency_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_6"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "department_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_7"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "employee_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_8"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "overtime_paid"
          },
          target: {
            tableId: "result_1",
            columnId: "column_9"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "pay_date"
          },
          target: {
            tableId: "result_1",
            columnId: "column_10"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "salary_paid"
          },
          target: {
            tableId: "result_1",
            columnId: "column_11"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "vacation_accrued"
          },
          target: {
            tableId: "result_1",
            columnId: "column_12"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "vacation_used"
          },
          target: {
            tableId: "result_1",
            columnId: "column_13"
          }
        }
      ]
    },
    {
      name: "qualified star",
      sql: "select s.* from account a, salary s",
      data: [
        {
          type: "table",
          id: "result_2",
          label: "account -> a",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 16,
            endColumn: 25
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_3",
          label: "salary -> s",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 27,
            endColumn: 35
          },
          data: {
            id: "salary"
          },
          columns: [
            {
              id: "currency_id",
              label: "currency_id",
              data: {
                id: "currency_id",
                tableId: "salary"
              }
            },
            {
              id: "department_id",
              label: "department_id",
              data: {
                id: "department_id",
                tableId: "salary"
              }
            },
            {
              id: "employee_id",
              label: "employee_id",
              data: {
                id: "employee_id",
                tableId: "salary"
              }
            },
            {
              id: "overtime_paid",
              label: "overtime_paid",
              data: {
                id: "overtime_paid",
                tableId: "salary"
              }
            },
            {
              id: "pay_date",
              label: "pay_date",
              data: {
                id: "pay_date",
                tableId: "salary"
              }
            },
            {
              id: "salary_paid",
              label: "salary_paid",
              data: {
                id: "salary_paid",
                tableId: "salary"
              }
            },
            {
              id: "vacation_accrued",
              label: "vacation_accrued",
              data: {
                id: "vacation_accrued",
                tableId: "salary"
              }
            },
            {
              id: "vacation_used",
              label: "vacation_used",
              data: {
                id: "vacation_used",
                tableId: "salary"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 0,
            endColumn: 35
          },
          columns: [
            {
              id: "column_1",
              label: "currency_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_2",
              label: "department_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_3",
              label: "employee_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_4",
              label: "overtime_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_5",
              label: "pay_date",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_6",
              label: "salary_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_7",
              label: "vacation_accrued",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            },
            {
              id: "column_8",
              label: "vacation_used",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 7,
                endColumn: 10
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "currency_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "department_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "employee_id"
          },
          target: {
            tableId: "result_1",
            columnId: "column_3"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "overtime_paid"
          },
          target: {
            tableId: "result_1",
            columnId: "column_4"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "pay_date"
          },
          target: {
            tableId: "result_1",
            columnId: "column_5"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "salary_paid"
          },
          target: {
            tableId: "result_1",
            columnId: "column_6"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "vacation_accrued"
          },
          target: {
            tableId: "result_1",
            columnId: "column_7"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "vacation_used"
          },
          target: {
            tableId: "result_1",
            columnId: "column_8"
          }
        }
      ]
    },
    {
      name: "common table expression",
      sql: "with a as (select * from account)\n" + "select account_type, a.account_id from a",
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 25,
            endColumn: 32
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 11,
            endColumn: 32
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_3",
              label: "account_description",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_4",
              label: "account_parent",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_5",
              label: "account_rollup",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 2,
            startColumn: 0,
            endColumn: 40
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 7,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 21,
                endColumn: 33
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_description"
          },
          target: {
            tableId: "result_2",
            columnId: "column_3"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_parent"
          },
          target: {
            tableId: "result_2",
            columnId: "column_4"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_rollup"
          },
          target: {
            tableId: "result_2",
            columnId: "column_5"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_2"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      name: "CTE uses other CTE",
      sql:
        "with a as (select * from account),\n" +
        "b as (select account_type, a.account_id from a)\n" +
        "select account_type, b.account_id from b",
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 25,
            endColumn: 32
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 11,
            endColumn: 32
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_3",
              label: "account_description",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_4",
              label: "account_parent",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            },
            {
              id: "column_5",
              label: "account_rollup",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 19
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_4",
          label: "b",
          level: 1,
          range: {
            startLine: 2,
            endLine: 2,
            startColumn: 6,
            endColumn: 46
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 13,
                endColumn: 25
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 27,
                endColumn: 39
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 3,
            startColumn: 0,
            endColumn: 40
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 3,
                endLine: 3,
                startColumn: 7,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 3,
                endLine: 3,
                startColumn: 21,
                endColumn: 33
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_description"
          },
          target: {
            tableId: "result_2",
            columnId: "column_3"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_parent"
          },
          target: {
            tableId: "result_2",
            columnId: "column_4"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_rollup"
          },
          target: {
            tableId: "result_2",
            columnId: "column_5"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_4",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_2"
          },
          target: {
            tableId: "result_4",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_4",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_4",
            columnId: "column_2"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      name: "CTE cannot be used directly",
      sql: "with a as (select account_id, account_type from account)\n" + "select account_type, a.account_id",
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 48,
            endColumn: 55
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 11,
            endColumn: 55
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 28
              }
            },
            {
              id: "column_2",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 30,
                endColumn: 42
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 2,
            startColumn: 0,
            endColumn: 33
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 7,
                endColumn: 19
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 21,
                endColumn: 33
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        }
      ]
    },
    {
      debug: true,
      only: true,
      name: "Merged leaves lineage",
      sql:
        "with a as (select account_id, account_type from account as a2)\n" +
        "select a1.account_type, a.account_id from a, account a1",
      mergedLeaves: true,
      data: [
        {
          type: "table",
          id: "result_3",
          label: "account",
          level: 0,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 48,
            endColumn: 61
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            },
            {
              id: "account_description",
              label: "account_description",
              data: {
                id: "account_description",
                tableId: "account"
              }
            },
            {
              id: "account_parent",
              label: "account_parent",
              data: {
                id: "account_parent",
                tableId: "account"
              }
            },
            {
              id: "account_rollup",
              label: "account_rollup",
              data: {
                id: "account_rollup",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_2",
          label: "a",
          level: 1,
          range: {
            startLine: 1,
            endLine: 1,
            startColumn: 11,
            endColumn: 61
          },
          columns: [
            {
              id: "column_1",
              label: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 18,
                endColumn: 28
              }
            },
            {
              id: "column_2",
              label: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 30,
                endColumn: 42
              }
            }
          ]
        },
        {
          type: "table",
          id: "result_1",
          label: "[final result]",
          level: 2,
          range: {
            startLine: 1,
            endLine: 2,
            startColumn: 0,
            endColumn: 55
          },
          columns: [
            {
              id: "column_1",
              label: "account_type",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 7,
                endColumn: 22
              }
            },
            {
              id: "column_2",
              label: "account_id",
              range: {
                startLine: 2,
                endLine: 2,
                startColumn: 24,
                endColumn: 36
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_id"
          },
          target: {
            tableId: "result_2",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_2",
            columnId: "column_2"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_3",
            columnId: "account_type"
          },
          target: {
            tableId: "result_1",
            columnId: "column_1"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "result_2",
            columnId: "column_1"
          },
          target: {
            tableId: "result_1",
            columnId: "column_2"
          }
        }
      ]
    }
  ];

  cases.forEach(({ data, name, only, sql, debug, mergedLeaves }) => {
    (only ? it.only : it)(`should parse ${name}`, () => {
      const lineage = antlr.parse(sql, { doubleQuotedIdentifier: true }).getLineage(getTable, mergedLeaves);
      if (debug) {
        const previous = fs.existsSync("debug.json") ? fs.readFileSync("debug.json", "utf-8") : "";
        const next = JSON.stringify(lineage, null, 2);

        if (previous !== next) {
          fs.writeFileSync("debug.json", next);
        }
      }
      expect(lineage).toEqual(data);
    });
  });
});
