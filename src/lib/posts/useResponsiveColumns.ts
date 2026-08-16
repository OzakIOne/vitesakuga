import { useEffect, useState } from "react";

type BreakpointColumn = {
  readonly columns: number;
  readonly minWidth: number;
};

// Mirrors the responsive `SimpleGrid` columns used by the posts list.
const BREAKPOINTS: readonly BreakpointColumn[] = [
  { columns: 5, minWidth: 1280 },
  { columns: 4, minWidth: 1024 },
  { columns: 3, minWidth: 768 },
  { columns: 2, minWidth: 640 },
] as const;

export function useResponsiveColumns(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const mqls = BREAKPOINTS.map((bp) =>
      window.matchMedia(`(min-width: ${bp.minWidth}px)`),
    );

    const update = () => {
      for (let i = 0; i < mqls.length; i++) {
        const bp = BREAKPOINTS[i];
        const mql = mqls[i];
        if (mql && mql.matches && bp) {
          setColumns(bp.columns);
          return;
        }
      }
      setColumns(1);
    };

    update();
    mqls.forEach((mql) => mql.addEventListener("change", update));
    return () =>
      mqls.forEach((mql) => mql.removeEventListener("change", update));
  }, []);

  return columns;
}
