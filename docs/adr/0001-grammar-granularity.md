# 1. Grammar granularity

Date: 2019-07-05

## Status

2019-07-05 proposed

2019-07-05 accepted

## Context

The goal of this project is to manipulate and make sense of sql statetements.

To be more precise, we have in mind to implement:

- is my statement have a join?
- is my statement have a select?
- is my statement have a sort?
- …
- add a join to an existing query
- add a sort to an existing query
- rename a column
- …

So far so good, to be able to do this kind of manipulation and helpers we don't need to understand the entire sql specification.

## Decision

We will try to implement the simplest grammar as possible in regard of our usecases.

For example, we will have a "generic token" to describe an expressionValue:

Sql => prettify CST
`VALUES 1, 2, 3` => `Values(ExpressionValues("1, 2, 3"))`
`VALUES 'a', 'b', 'c'` => `Values(ExpressionValues('a', 'b', 'c'))`

## Consequences

As consequences, we will not able to make sense of what is inside an ExpressionValues and we will not implement a 1 to 1 grammar from the calcite bnf.

This should not impact the future of the library, since we can always add more token/rules to cover new parts of the language.
