import { CharStreams, CommonTokenStream } from "antlr4ts";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { getLineage } from "./LineageUtil";

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

let metadataProvider = {
  getTable: getTable,
  getColumns: getColumns
};

describe("antlr", () => {
  it("should build parse tree", () => {
    const input = "select * from emp";
    let inputStream = new UppercaseCharStream(CharStreams.fromString(input));
    let lexer = new SqlBaseLexer(inputStream);
    let tokens = new CommonTokenStream(lexer);
    let parser = new SqlBaseParser(tokens);
    parser.buildParseTree = true;
    let tree = parser.statement();
    expect(tree.toStringTree()).toBe(
      "(select*fromemp (select*fromemp (select*fromemp (select*fromemp (select*fromemp (select* select (* (* (* (* (* (* *))))))) (fromemp from (emp (emp (emp (emp (emp (emp emp)) )) )))))) ))"
    );
  });

  it("should walk through tree", () => {
    const sql =
      "select sq.account_id as account_id, e.employee_id as employee_id \n" +
      "from (select account_id as account_id, account_type as account_type from account as d) as sq, \n" +
      "   employee as e";
    console.log(
      JSON.stringify(getLineage(sql, metadataProvider), undefined, 2)
    );
  });

  it("should deduce column names", () => {
    const sql =
      "select sq.account_id, account_type \n" +
      "from (select account_id, account.account_type from account) as sq, \n" +
      "   employee as e";
    console.log(
      JSON.stringify(getLineage(sql, metadataProvider), undefined, 2)
    );
  });

  it("should support PostgreSQL cast", () => {
    const sql = "select account_id::varchar " + "from account";
    console.log(
      JSON.stringify(getLineage(sql, metadataProvider), undefined, 2)
    );
  });

  it("should support double-quoted identifiers", () => {
    const sql = 'select "account_id", 1 as "one "" " ' + "from account";
    console.log(
      JSON.stringify(getLineage(sql, metadataProvider), undefined, 2)
    );
  });
});
