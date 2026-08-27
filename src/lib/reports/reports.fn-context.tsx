import { createContext } from "react";

import { submitPostReport as _submitPostReport } from "./reports.service";

export const defaultReportsFns = {
  submitPostReport: _submitPostReport,
};

export const ReportsFnsContext = createContext(defaultReportsFns);
