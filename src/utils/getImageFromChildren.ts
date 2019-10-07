import { CstChildrenDictionary, CstElement, CstNode } from "chevrotain";

function isCstNode(element: CstElement): element is CstNode {
  return Boolean((element as any).name);
}

/**
 * Extract every `node.image` recursively into `image`
 *
 * @param children
 * @param image The textual representation of the Token as it appeared in the text.
 */
const extractImage = (children: CstChildrenDictionary, image: string[]) =>
  Object.values(children).forEach(tokens => {
    if (!Array.isArray(tokens)) return;
    tokens.forEach(token => {
      if (isCstNode(token)) {
        extractImage(token.children, image);
        return;
      }
      token.image.split("").forEach((char, i) => {
        if (token.startColumn) {
          image[token.startColumn + i] = char;
        }
      });
    });
  });

/**
 * Extract the `image` from a children dictionary.
 *
 * /!\ This function only deal with one line context /!\
 * @param children
 */
export const getImageFromChildren = (
  children: CstChildrenDictionary
): string => {
  const image: string[] = [];
  extractImage(children, image); // This mutate `image` directly

  let output = "";
  for (let i = 0; i < image.length; i++) {
    output += image[i] === undefined ? " " : image[i];
  }
  return output.trim();
};
