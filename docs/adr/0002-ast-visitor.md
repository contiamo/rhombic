# 2. ast-visitor

Date: 2019-08-07

## Status

2019-08-07 proposed

2019-08-07 accepted

## Context

To be able to implement our sql helpers, we need to use an AST visitor to pick some information from our CST.

The question is, should we unit test this AST Visitor as a separate part?

## Decision

Because every behaviour of this AST Visitor serve our public API, we decide to test this AST Visitor throw our public API.

This is to avoid to link test with implementation details. AST Visitor is an implementation detail, and we should be able to refactor this part without breaking the public API / tests.

## Consequences

No AstVisitor.test.ts, the test coverage of this part need to be cover on index.test.ts.
