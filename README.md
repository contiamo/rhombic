![Rhombic](./docs/rhombic-logo.svg)

Parser and helpers around [Calcite SQL](https://calcite.apache.org/docs/reference.html)

The goal of this project is to generate an AST from a SQL statement to provide a simple way to analyse and manipulate any query.

## Getting started

```bash
npm install rhombic
```

```ts
import rhombic from "rhombic";

const query = rhombic
  .parse("SELECT * FROM abc;")
  .addJoin({ type: "INNER", on: "foodmart.city = abc.city", table: "foodmart" })
  .toString();

console.log(query); // SELECT * FROM abc INNER JOIN foodmart ON foodmart.city = abc.city;
```

## What's inside?

Thanks to the amazing [Chevrotain](https://sap.github.io/chevrotain), we generate an AST from any Calcite SQL statements. After this first parsing phase, we "just" apply modifiers to the AST to perform any wanted operations or analysis.

## Why this name?

> Soft enough to be easily scratched by a nail, calcite crystals can also be identified by their rhombic cleavage.

https://www.esci.umn.edu/courses/1001/minerals/calcite.shtml

## Resources

[Calcite SQL Reference](https://calcite.apache.org/docs/reference.html)

[Calcite grammar](https://github.com/apache/calcite/blob/master/core/src/main/codegen/templates/Parser.jj)

[SQL 2003-2 BNF](https://github.com/ronsavage/SQL/blob/master/sql-2003-2.bnf)
