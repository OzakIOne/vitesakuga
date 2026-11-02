import { expect, type Locator } from "@playwright/test";

const REACT_PROPS_KEY_PREFIX = "__reactProps";

/**
 * Pages are server-rendered, so elements are visible about a second before
 * React hydrates them. Clicks, fills and file selections made in that window
 * are dropped. React attaches its props to each DOM node it hydrates, so
 * waiting for them on an element proves its handlers are live.
 */
export const waitForHydration = async (locator: Locator) => {
  await expect
    .poll(
      () =>
        locator.evaluate(
          (element, prefix) =>
            // oxlint-disable-next-line effecttsgo/prefer-effect-record, effecttsgo/prefer-effect-array, effecttsgo/prefer-effect-string -- Playwright serializes this callback into the browser page, where the effect module is not loaded
            Object.keys(element).some((key) => key.startsWith(prefix)),
          REACT_PROPS_KEY_PREFIX,
        ),
      { message: "element was never hydrated by React", timeout: 30000 },
    )
    .toBe(true);
};
