export const rc = (classNames: (string | null | undefined)[]): string => {
  const filteredClassNames = classNames.filter(
    (cn) => typeof cn === "string" && cn.length
  ) as string[];

  return filteredClassNames.join(" ");
};
