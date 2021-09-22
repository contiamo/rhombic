import { readdirSync, readFileSync } from "fs";
import { TablePrimary } from "../..";
import { Lineage } from "../../Lineage";

export const TESTS_PATH = `${__dirname}/`;

type TestCase = {
  sql: string | Array<string>;
  data?: Lineage<{ id: string }, { id: string; tableId: string }>;
  only?: boolean;
  debug?: boolean; // output in debug.json
  mergedLeaves?: boolean;
  options?: {
    positionalRefsEnabled?: boolean;
  };
};

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

export const getTable = (table: TablePrimary) => {
  if (!(table.tableName in columnsMapping)) {
    return undefined;
  }

  const columnNames = columnsMapping[table.tableName];
  const columns = columnNames.map(columnId => ({
    id: columnId,
    data: { id: columnId, tableId: table.tableName }
  }));
  return {
    table: { id: table.tableName, data: { id: table.tableName } },
    columns
  };
};

export const getLineageTests = () =>
  readdirSync(TESTS_PATH)
    .filter(s => s.endsWith(".json"))
    .map(file => {
      const raw = readFileSync(`${TESTS_PATH}/${file}`);
      const name = file.slice(0, -".json".length);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const testCase: TestCase = JSON.parse(raw.toString());
      return { file, name, testCase };
    });
