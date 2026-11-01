import type { ReportsFns } from "./reports.fn-context";
import { submitPostReport } from "./reports.service";

export const defaultReportsFns: ReportsFns = {
  submitPostReport,
};
