import { CharStreams, CommonTokenStream } from "antlr4ts";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";
import { getLineage } from "./LineageUtil";
import { Lineage, Table } from "../Lineage";

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

const metadataProvider = {
  getTable: getTable,
  getColumns: getColumns
};

// function to log lineage when testing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logLineage<TableData extends { id: string }, ColumnData extends { id: string }>(
  lineage: Lineage<TableData, ColumnData>
) {
  console.log(JSON.stringify(lineage, undefined, 2));
}

describe("antlr", () => {
  it("should build parse tree", () => {
    const input = "select * from emp";
    const inputStream = new UppercaseCharStream(CharStreams.fromString(input));
    const lexer = new SqlBaseLexer(inputStream);
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.buildParseTree = true;
    const tree = parser.statement();
    expect(tree.toStringTree()).toBe(
      "(select*fromemp (select*fromemp (select*fromemp (select*fromemp (select*fromemp (select* select (* (* (* (* (* (* *))))))) (fromemp from (emp (emp (emp (emp (emp (emp emp)) )) )))))) ))"
    );
  });

  it("should work with aliases", () => {
    const sql =
      "select sq.account_id as account_id, e.employee_id as employee_id \n" +
      "from (select account_id as account_id, account_type as account_type from account as d) as sq, \n" +
      "   employee as e";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(4);
  });

  it("should deduce column names", () => {
    const sql =
      "select sq.account_id, account_type \n" +
      "from (select account_id, account.account_type from account) as sq, \n" +
      "   employee as e";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(4);
  });

  it("should support PostgreSQL cast", () => {
    const sql = "select account_id::varchar " + "from account";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(1);
  });

  it("should support double-quoted identifiers", () => {
    const sql = 'select "account_id", 1 as "one "" " ' + "from account";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(1);
    const table = lin.filter(e => e.type == "table").find(t => t.label == "[final result]") as Table<unknown, unknown>;
    expect(table.columns).toHaveLength(2);
    expect(table.columns.filter(c => c.label == 'one " ')).toHaveLength(1);
  });

  it("should support matching quoted identifiers", () => {
    const sql = 'select accOUNT_ID as "acc_id" from (select "account_id", ACCounT_TypE from account) as a';
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(3);
  });

  it("should support star on subquery", () => {
    const sql = 'select * from (select "account_id", ACCounT_TypE from account) as a';
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(4);
  });

  it("should support star on join", () => {
    const sql = "select * from account, salary";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(13);
  });

  it("should support qualified star", () => {
    const sql = "select s.* from account a, salary s";
    const lin = getLineage(sql, metadataProvider);
    expect(lin.filter(e => e.type == "edge")).toHaveLength(8);
  });
});
