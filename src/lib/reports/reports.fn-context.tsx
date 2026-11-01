import { createContext, useContext } from "react";

import type { submitPostReport } from "./reports.service";

export type ReportsFns = {
  submitPostReport: typeof submitPostReport;
};

export const ReportsFnsContext = createContext<ReportsFns | null>(null);

export const useReportsFns = (): ReportsFns => {
  const fns = useContext(ReportsFnsContext);
  if (fns === null) {
    throw new Error("ReportsFnsContext is not provided");
  }
  return fns;
};
