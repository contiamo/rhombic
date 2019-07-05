/**
 * Script to generate railroad diagrams from the grammar.
 *
 * Command:
 *  `yarn gen-diagrams`
 *
 * Result:
 *  `docs/diagrams.html`
 */
import { writeFileSync } from "fs";
import program from "commander";
import chalk from "chalk";
import chokidar from "chokidar";
import { join } from "path";
import { createSyntaxDiagramsCode } from "chevrotain";

import { parser } from "./SqlParser";

program
  .version(require("../package.json").version)
  .option("-w, --watch", "Watch the filesystem for rebuild")
  .parse(process.argv);

function generateDiagrams() {
  const grammar = parser.getSerializedGastProductions();
  const html = createSyntaxDiagramsCode(grammar);

  writeFileSync(join(__dirname, "../docs/diagrams.html"), html);
  console.log(chalk.green("✔") + " diagrams generated!");
}

generateDiagrams();

if (program.watch) {
  chokidar.watch([`src/SqlParser.ts`]).on("change", generateDiagrams);
}
