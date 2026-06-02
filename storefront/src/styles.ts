import sharedStyles from "./styles/shared.module.css";

type StylesMap = Record<string, string>;

export function createCx(...styleMaps: StylesMap[]) {
  const maps = [...styleMaps, sharedStyles];

  return (...classNames: Array<string | false | null | undefined>) =>
    classNames
      .filter((className): className is string => Boolean(className))
      .map((className) => maps.find((styles) => styles[className])?.[className] ?? className)
      .join(" ");
}

export const cx = createCx();
