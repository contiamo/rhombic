import { CstChildrenDictionary } from "chevrotain";
import { isCstNode } from "./isCstNode";

/**
 * Pretty output for cst for easy specifications
 *
 * @param cst
 */
export function prettifyCst(cst: CstChildrenDictionary) {
  let output = "";
  Object.entries(cst).forEach(([_, elements]) => {
    elements.forEach((node, i, nodes) => {
      if (isCstNode(node)) {
        output += node.name + "(" + prettifyCst(node.children) + ")";
      } else {
        if (i === 0 && node.tokenType) output += node.tokenType.tokenName;
        if (i === 0) output += "(";
        output += `"${node.image}"`;
        if (i === nodes.length - 1) output += ")";
        else output += ",";
      }
    });
  });
  return output;
}
