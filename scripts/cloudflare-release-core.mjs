export const parseNumberValue = ({
  name,
  value,
  fallback,
  integer = false,
}) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw new Error(
      `${name} must be a valid ${integer ? "integer" : "number"}`,
    );
  }

  return parsed;
};

export const selectActiveVersion = (deployments) => {
  const activeDeployment = [...deployments].sort((left, right) => {
    const leftDate = left.created_on ?? left.createdOn ?? "";
    const rightDate = right.created_on ?? right.createdOn ?? "";
    return rightDate.localeCompare(leftDate);
  })[0];
  const versions = Array.isArray(activeDeployment?.versions)
    ? activeDeployment.versions
    : [];

  return [...versions].sort(
    (left, right) => (right.percentage ?? 0) - (left.percentage ?? 0),
  )[0];
};

export const validateMonitoringConfiguration = ({
  maxErrorRate,
  minRequests,
  attempts,
  intervalMilliseconds,
}) => {
  if (maxErrorRate < 0 || maxErrorRate > 1) {
    throw new Error("MAX_ERROR_RATE must be between 0 and 1");
  }
  if (minRequests < 1 || attempts < 1 || intervalMilliseconds < 1) {
    throw new Error("Monitoring thresholds must be positive");
  }
};

export const getErrorRate = ({ errors, requests }) =>
  requests === 0 ? 0 : errors / requests;

export const exceedsErrorRateThreshold = ({
  metrics,
  maxErrorRate,
  minRequests,
}) => {
  if (metrics.requests < minRequests) {
    return false;
  }

  return getErrorRate(metrics) > maxErrorRate;
};

export const createRollbackCommand = ({
  previousVersionId,
  workerName,
  deployedVersionId,
}) => ({
  command: "nubx",
  args: [
    "wrangler",
    "rollback",
    previousVersionId,
    "--name",
    workerName,
    "--message",
    `Automatic rollback after failed release health checks (${deployedVersionId ?? "unknown version"})`,
  ],
});
