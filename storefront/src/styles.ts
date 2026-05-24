import styles from "./styles.module.css";

export function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames
    .filter((className): className is string => Boolean(className))
    .map((className) => styles[className] ?? className)
    .join(" ");
}

