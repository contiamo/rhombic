import rhombic from ".";
import { Lineage } from "./Lineage";
import * as fs from "fs";

// Accessors mocks
type ColumnId = string;
const columnsMapping: { [tableId: string]: ColumnId[] } = {
  account: [
    "account_type",
    "account_id",
    "account_description",
    "account_parent",
    "account_rollup"
  ],
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

const getTable = (id: string) => ({
  id
});

const getColumns = (tableId: string) => {
  const columns = columnsMapping[tableId] || [];
  return columns.map(columnId => ({
    id: columnId,
    tableId
  }));
};

describe("getLineage", () => {
  const cases: Array<{
    name: string;
    sql: string;
    data: Lineage<{ id: string }, { id: string; tableId: string }>;
    only?: boolean;
    debug?: boolean; // output in debug.json
  }> = [
    {
      name: "simple",
      sql: "SELECT account_type as type, account_id FROM account;",
      data: [
        {
          type: "table",
          id: "account",
          label: "account",
          range: {
            startLine: 1,
            startColumn: 46,
            endLine: 1,
            endColumn: 52
          },
          data: {
            id: "account"
          },
          columns: [
            {
              id: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 27
              },
              label: "account_type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 30,
                endColumn: 39
              },
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [],
          columns: [
            {
              id: "account_type",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 27
              },
              label: "type",
              data: {
                id: "account_type",
                tableId: "account"
              }
            },
            {
              id: "account_id",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 30,
                endColumn: 39
              },
              label: "account_id",
              data: {
                id: "account_id",
                tableId: "account"
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "account",
            columnId: "account_type"
          },
          target: {
            tableId: "result",
            columnId: "account_type"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "account",
            columnId: "account_id"
          },
          target: {
            tableId: "result",
            columnId: "account_id"
          }
        }
      ]
    },
    {
      name: "Natural join",
      sql:
        "SELECT vacation_used, salary_paid AS salary, gender FROM salary NATURAL JOIN employee",
      data: [
        {
          type: "table",
          id: "salary",
          label: "salary",
          range: {
            startLine: 1,
            startColumn: 58,
            endLine: 1,
            endColumn: 63
          },
          data: {
            id: "salary"
          },
          columns: [
            {
              id: "vacation_used",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 20
              },
              label: "vacation_used",
              data: {
                id: "vacation_used",
                tableId: "salary"
              }
            },
            {
              id: "salary_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 23,
                endColumn: 43
              },
              label: "salary_paid",
              data: {
                id: "salary_paid",
                tableId: "salary"
              }
            }
          ]
        },
        {
          type: "table",
          id: "employee",
          label: "employee",
          range: {
            startLine: 1,
            startColumn: 78,
            endLine: 1,
            endColumn: 85
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 46,
                endColumn: 51
              },
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [],
          columns: [
            {
              id: "vacation_used",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 20
              },
              label: "vacation_used",
              data: {
                id: "vacation_used",
                tableId: "salary"
              }
            },
            {
              id: "salary_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 23,
                endColumn: 43
              },
              label: "salary",
              data: {
                id: "salary_paid",
                tableId: "salary"
              }
            },
            {
              id: "gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 46,
                endColumn: 51
              },
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "salary",
            columnId: "vacation_used"
          },
          target: {
            tableId: "result",
            columnId: "vacation_used"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "salary",
            columnId: "salary_paid"
          },
          target: {
            tableId: "result",
            columnId: "salary_paid"
          }
        },
        {
          type: "edge",
          source: {
            tableId: "employee",
            columnId: "gender"
          },
          target: {
            tableId: "result",
            columnId: "gender"
          }
        }
      ]
    },
    {
      name: "where",
      sql: "SELECT first_name FROM  employee WHERE department_id = 1",
      data: [
        {
          type: "table",
          id: "employee",
          label: "employee",
          range: {
            startLine: 1,
            startColumn: 25,
            endLine: 1,
            endColumn: 32
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "first_name",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 17
              },
              label: "first_name",
              data: {
                id: "first_name",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [
            {
              type: "filter",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 34,
                endColumn: 56
              }
            }
          ],
          columns: [
            {
              id: "first_name",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 17
              },
              label: "first_name",
              data: {
                id: "first_name",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "employee",
            columnId: "first_name"
          },
          target: {
            tableId: "result",
            columnId: "first_name"
          }
        }
      ]
    },
    {
      name: "concat",
      debug: true,
      sql:
        "SELECT concat(first_name, ' ', last_name) as full_name FROM employee",
      data: [
        {
          type: "table",
          id: "employee",
          label: "employee",
          range: {
            startLine: 1,
            startColumn: 61,
            endLine: 1,
            endColumn: 68
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "first_name",
              range: {
                // This can be improved
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 54
              },
              label: "first_name",
              data: {
                id: "first_name",
                tableId: "employee"
              }
            },
            {
              id: "last_name",
              range: {
                // This can be improved
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 54
              },
              label: "last_name",
              data: {
                id: "last_name",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [],
          columns: [
            {
              id: "concat(first_name, ' ', last_name)",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 54
              },
              label: "full_name"
            }
          ]
        },
        {
          type: "edge",
          label: "concat",
          source: {
            tableId: "employee",
            columnId: "first_name"
          },
          target: {
            tableId: "result",
            columnId: "concat(first_name, ' ', last_name)"
          }
        },
        {
          type: "edge",
          label: "concat",
          source: {
            tableId: "employee",
            columnId: "last_name"
          },
          target: {
            tableId: "result",
            columnId: "concat(first_name, ' ', last_name)"
          }
        }
      ]
    },
    {
      name: "group by",
      sql: "SELECT gender, AVG(salary) FROM employee GROUP BY gender",
      data: [
        {
          type: "table",
          id: "employee",
          label: "employee",
          range: {
            startLine: 1,
            startColumn: 33,
            endLine: 1,
            endColumn: 40
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 13
              },
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            },
            {
              id: "salary",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 16,
                endColumn: 26
              },
              label: "salary",
              data: {
                id: "salary",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [
            {
              type: "groupBy",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 42,
                endColumn: 56
              }
            }
          ],
          columns: [
            {
              id: "gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 13
              },
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            },
            {
              id: "AVG(salary)",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 16,
                endColumn: 26
              },
              label: "AVG(salary)"
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "employee",
            columnId: "gender"
          },
          target: {
            tableId: "result",
            columnId: "gender"
          }
        },
        {
          type: "edge",
          label: "AVG",
          source: {
            tableId: "employee",
            columnId: "salary"
          },
          target: {
            tableId: "result",
            columnId: "AVG(salary)"
          }
        }
      ]
    },
    {
      name: "group by & join (namespaced projectionItems)",
      sql:
        "SELECT employee.gender, AVG(salary.overtime_paid) as overtime, AVG(employee.salary) as salary FROM employee JOIN salary ON employee.employee_id = salary.employee_id GROUP BY employee.gender",
      data: [
        {
          type: "table",
          id: "employee",
          label: "employee",
          range: {
            startLine: 1,
            startColumn: 100,
            endLine: 1,
            endColumn: 107
          },
          data: {
            id: "employee"
          },
          columns: [
            {
              id: "gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 22
              },
              label: "gender",
              data: {
                id: "gender",
                tableId: "employee"
              }
            },
            {
              id: "salary",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 64,
                endColumn: 93
              },
              label: "salary",
              data: {
                id: "salary",
                tableId: "employee"
              }
            }
          ]
        },
        {
          type: "table",
          id: "salary",
          label: "salary",
          range: {
            startLine: 1,
            startColumn: 114,
            endLine: 1,
            endColumn: 119
          },
          data: {
            id: "salary"
          },
          columns: [
            {
              id: "overtime_paid",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 25,
                endColumn: 61
              },
              label: "overtime_paid",
              data: {
                id: "overtime_paid",
                tableId: "salary"
              }
            }
          ]
        },
        {
          type: "table",
          id: "result",
          label: "[result]",
          modifiers: [
            {
              type: "groupBy",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 166,
                endColumn: 189
              }
            }
          ],
          columns: [
            {
              id: "employee.gender",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 8,
                endColumn: 22
              },
              label: "employee.gender"
            },
            {
              id: "AVG(salary.overtime_paid)",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 25,
                endColumn: 61
              },
              label: "overtime"
            },
            {
              id: "AVG(employee.salary)",
              range: {
                startLine: 1,
                endLine: 1,
                startColumn: 64,
                endColumn: 93
              },
              label: "salary"
            }
          ]
        },
        {
          type: "edge",
          source: {
            tableId: "employee",
            columnId: "gender"
          },
          target: {
            tableId: "result",
            columnId: "employee.gender"
          }
        },
        {
          type: "edge",
          label: "AVG",
          source: {
            tableId: "salary",
            columnId: "overtime_paid"
          },
          target: {
            tableId: "result",
            columnId: "AVG(salary.overtime_paid)"
          }
        },
        {
          type: "edge",
          label: "AVG",
          source: {
            tableId: "employee",
            columnId: "salary"
          },
          target: {
            tableId: "result",
            columnId: "AVG(employee.salary)"
          }
        }
      ]
    }
  ];

  cases.forEach(({ data, name, only, sql, debug }) => {
    (only ? it.only : it)(`should parse ${name}`, () => {
      const lineage = rhombic.parse(sql).getLineage({ getTable, getColumns });
      if (debug) {
        const previous = fs.existsSync("debug.json")
          ? fs.readFileSync("debug.json", "utf-8")
          : "";
        const next = JSON.stringify(lineage, null, 2);

        if (previous !== next) {
          fs.writeFileSync("debug.json", next);
        }
      }
      expect(lineage).toEqual(data);
    });
  });
});
