import rhombic from ".";
import { Lineage } from "./Lineage";

describe("getLineage", () => {
  const getTable = (id: string) => ({
    id
  });

  const getColumns = (tableId: string) =>
    ["account_type", "account_id"].map(columnId => ({
      id: columnId,
      tableId
    }));

  const cases: Array<{
    name: string;
    sql: string;
    data: Lineage<{ id: string }, { id: string; tableId: string }>;
    only?: boolean;
  }> = [
    {
      name: "simple",
      sql: "SELECT account_type, account_id FROM account;",
      data: [
        {
          type: "table",
          id: "account",
          label: "account",
          range: {
            endColumn: 44,
            endLine: 1,
            startColumn: 38,
            startLine: 1
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
            }
          ],
          data: {
            id: "account"
          }
        }
      ]
    }
  ];

  cases.forEach(({ data, name, only, sql }) => {
    (only ? it.only : it)(`should parse ${name}`, () => {
      expect(rhombic.parse(sql).getLineage(getTable, getColumns)).toEqual(data);
    });
  });
});
