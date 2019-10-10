import { reserved } from "../reserved";

/**
 * Returns `true` if the identifier needs to be escaped
 * @param identifier
 */
export const needToBeEscaped = (identifier: string) =>
  reserved.includes(identifier.toUpperCase()) ||
  !/^[a-zA-Z]\w*$/.exec(identifier);
