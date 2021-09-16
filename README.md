<img src="https://unpkg.com/rhombic@0.0.1/docs/rhombic-logo.svg" alt="Rhombic-logo" width="400px" />

Utilities for parsing, analysing and manipulating SQL.

## Getting started

```bash
npm install rhombic
```

```ts
import rhombic from "rhombic";

try {
  const query = rhombic
    .parse("SELECT * FROM abc;")
    .addProjectionItem("city")
    .toString();

  console.log(query); // SELECT city FROM abc;
} catch (e) {
  // Parsing errors
}
```

## Description

Rhombic can parse SQL with 2 different parsers with different sets of operations applicable in each case:

- [Chevrotain](https://sap.github.io/chevrotain) based parser built from ground up to support simple statements
  for ANSI SQL dialect. Parsed SQL tree can then be manipulated (adding projection items, ordering, filters) and
  serialized back to SQL text. For details and available operations see [src/index.ts](src/index.ts)
- [Antlr](https://www.antlr.org) based parser (generated with [antlr4ts](https://github.com/tunnelvisionlabs/antlr4ts)) from SQL grammar derived from Apache Spark SQL grammar with the goal to support most SQL dialects with broad functionality. Currenly this mode can be used to extract SQL column level lineage. For details and available operations see [src/antlr/index.ts](src/antlr/index.ts)

## Antlr parser lineage

To build SQL column level lineage for an SQL query using Antlr-based parser:

```ts
import { antlr, TablePrimary } from "rhombic";

try {
  const parsingOptions = {
    // if double quotes should quote identifiers:
    doubleQuotedIdentifier: true
  };
  const q = antlr.parse("SELECT * FROM abc;", parsingOptions);

  console.log(q.getUsedTables()); // [{ tableName: "abc" }];
  const getTable = (table: TablePrimary) => {
    /* Logic to retrieve table & columns metadata */
  };

  // Whether to use "mergedLeaves" or "tree" lineage type
  const mergedLeaves = true;
  const lineageOptions = {
    positionalRefsEnabled: false
  };
  const lineage = q.getLineage(getTable, mergedLeaves, lineageOptions);
  // Use react-flow to draw a nice sql lineage
} catch (e) {
  // Parsing errors
}
```

## How to publish to npm?

Just update the `version` in `package.json`!

As soon as your branch will be merged to master, a new npm version will be automatically published for you.

## History

This project was built to support Contiamo® workbench editor (a fancy SQL editor) based on CalciteSQL.
Our product evolved to switch to PostgreSQL instead of CalciteSQL, as result, Rhombic supports CalciteSQL and PostgreSQL!

To achieve this, the grammar implemented in Rhombic will go in favor of the more generic version to support all features of both SQL implementations. This should be totally transparent, since the input of rhombic is a SQL query. Just be careful to not use some CalciteSQL/PostgreSQL specific feature when you mutate a SQL query.

### Why this name?

> Soft enough to be easily scratched by a nail, calcite crystals can also be identified by their rhombic cleavage.

https://www.esci.umn.edu/courses/1001/minerals/calcite.shtml

## Resources

[SQL 2003-2 BNF](https://github.com/ronsavage/SQL/blob/master/sql-2003-2.bnf)
