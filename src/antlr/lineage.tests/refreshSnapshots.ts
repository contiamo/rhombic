import { writeFileSync } from "fs";
import { join } from "path";
import antlr from "..";
import { getLineageTests, getTable, TESTS_PATH } from "./getLineageTests";

const tests = getLineageTests();

tests.forEach(test => {
  const { sql, mergedLeaves, options } = test.testCase;
  const sqlStr = sql instanceof Array ? sql.join("\n") : sql;
  const lineage = antlr.parse(sqlStr, { doubleQuotedIdentifier: true }).getLineage(getTable, mergedLeaves, options);
  console.log(`Writing ${join(TESTS_PATH, test.file)}`);
  writeFileSync(
    join(TESTS_PATH, test.file),
    JSON.stringify(
      {
        ...test.testCase,
        data: lineage
      },
      null,
      2
    )
  );
});
