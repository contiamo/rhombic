/**
 * Script to generate railroad diagrams from the grammar.
 *
 * Command:
 *  `yarn gen:diagrams`
 *
 * Result:
 *  `docs/diagrams.html`
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { parser } from "./SqlParser";
import { createSyntaxDiagramsCode } from "chevrotain";

const grammar = parser.getSerializedGastProductions();
const html = createSyntaxDiagramsCode(grammar);

writeFileSync(join(__dirname, "../docs/diagrams.html"), html);
