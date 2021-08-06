<img src="https://unpkg.com/rhombic@0.0.1/docs/rhombic-logo.svg" alt="Rhombic-logo" width="400px" />

Parser and helpers around [Calcite SQL](https://calcite.apache.org/docs/reference.html)

The goal of this project is to generate an AST from a SQL statement to provide a simple way to analyse and manipulate any query.

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

## What's inside?

Thanks to the amazing [Chevrotain](https://sap.github.io/chevrotain), we generate an AST from any Calcite SQL statements. After this first parsing phase, we "just" apply modifiers to the AST to perform any wanted operations or analysis.

## Antlr parser

Rhombic have currently a part relying on antlr as parser, this is to take advantage of the already existing sql grammar from spark. This parser is currently there to support the lineage feature and can be access like this:

```ts
import { antlr, TablePrimary } from "rhombic";

try {
  const q = antlr.parse("SELECT * FROM abc;");

  console.log(q.getUsedTables()); // [{ tableName: "abc" }];
  const getTable = (table: TablePrimary) => {
    /* Logic to retrieve table & columns metadata */
  };
  const lineage = q.getLineage(getTable);
  // Use react-flow to draw a nice sql lineage
} catch (e) {
  // Parsing errors
}
```

## PostgreSQL compatibility

This project was built to support Contiamo® workbench editor (a fancy SQL editor) based on CalciteSQL.
Our product evolved to switch to PostgreSQL instead of CalciteSQL, as result, Rhombic supports CalciteSQL and PostgreSQL!

To achieve this, the grammar implemented in Rhombic will go in favor of the more generic version to support all features of both SQL implementations. This should be totally transparent, since the input of rhombic is a SQL query. Just be careful to not use some CalciteSQL/PostgreSQL specific feature when you mutate a SQL query.

## Why this name?

> Soft enough to be easily scratched by a nail, calcite crystals can also be identified by their rhombic cleavage.

https://www.esci.umn.edu/courses/1001/minerals/calcite.shtml

## Resources

[Calcite SQL Reference](https://calcite.apache.org/docs/reference.html)

[Calcite grammar](https://github.com/apache/calcite/blob/master/core/src/main/codegen/templates/Parser.jj)

[SQL 2003-2 BNF](https://github.com/ronsavage/SQL/blob/master/sql-2003-2.bnf)

## How to publish to npm?

Just update the `version` in `package.json`!

As soon as your branch will be merged to master, a new npm version will be automatically published for you.
