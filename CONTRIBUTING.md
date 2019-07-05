# Contributing to Rhombic

## Architecture decisions

Architecture decisions for this project [are documented here][adrs], using the [Architecture Decision Records (ADR)][adrs-pattern] pattern.

More information with `yarn adr --help`

## Tests

Every layers are unit tests with [jest][jest]. The goal of these tests are to help the developer to have a quick feedback loop.

As much as possible we try to have a nice testing framework with a good level of abstraction to test what need to be tested. This ensure a good project quality and permit us to iterate safely.

## Code Style

Style formatting is managed by [Prettier][prettier]. It runs as a pre-commit hook, so you shouldn't have to worry about it 👐

There a few conventions that we'd like to keep consistent and are not automatically enforced yet.

<!-- Links -->

[jest]: https://jestjs.io/
[prettier]: https://prettier.io
[adrs-pattern]: http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions
[adrs]: https://github.com/contiamo/rhombic/blob/master/docs/adr
