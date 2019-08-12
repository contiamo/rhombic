import { writeFileSync } from "fs";
import chalk from "chalk";
import { join } from "path";
import { pascal } from "case";
import isEmpty from "lodash/isEmpty";

import { ISerializedGast } from "chevrotain";

/**
 * Script to generate context types from the grammar.
 *
 * Result:
 *  `src/Context.ts`
 */
export function generateContextTypes(grammar: ISerializedGast[]) {
  let types = `// Auto-generated by generateContextTypes.ts
import { IToken } from "chevrotain";
`;
  // ISerializedGast definition doesn't contain all details
  // let's escape from type safety here 🤠 (we are on a production sensible context)
  grammar.forEach((rule: any) => {
    if (rule.type === "Rule") {
      const def = generateDefinitionTypes(rule.definition, 2);
      types += def.includes("|")
        ? `\nexport type ${pascal(rule.name)}Context = \n  | {`
        : `\nexport interface ${pascal(rule.name)}Context {`;
      types += def;
      types += "\n}\n";
    }
  });
  writeFileSync(join(__dirname, "../Context.ts"), types);
  console.log(chalk.green("✔") + " context types generated!");
}

function generateDefinitionTypes(
  definition: any[],
  indent = 2,
  optionnal = false
): string {
  return definition
    .map((node: any) => {
      switch (node.type) {
        case "Terminal":
          return `\n${" ".repeat(indent)}${node.name}${
            optionnal ? "?" : ""
          }: IToken[];`;

        case "NonTerminal":
          return `\n${" ".repeat(indent)}${node.name}: Array<{\n${" ".repeat(
            indent + 2
          )}name: "${node.name}";\n${" ".repeat(indent + 2)}children: ${pascal(
            node.name
          )}Context;\n${" ".repeat(indent)}}>;`;

        case "Option":
          return generateDefinitionTypes(node.definition, indent, true);

        case "Alternation":
          const isTerminalOnly = !JSON.stringify(node.definition).includes(
            "NonTerminal"
          );

          const entries = new Set();
          return "\n" + isTerminalOnly
            ? node.definition
                .map((i: any) => generateDefinitionTypes(i.definition, 0, true))
                .join("")
                .split("\n")
                .filter((j: string) => {
                  const isAlreadyDefined = entries.has(j);
                  if (!j.includes("}>;")) {
                    entries.add(j);
                  }
                  return !isEmpty(j) && !isAlreadyDefined;
                })
                .join("\n")
            : node.definition
                .map((i: any) =>
                  generateDefinitionTypes(i.definition, 0).replace("\n", "")
                )
                .join("} | {");

        case "Flat":
          return generateDefinitionTypes(node.definition).replace(/[\n;]/g, "");

        default:
          return "";
      }
    })
    .join("");
}
