import { defineRule } from "@oxlint/plugins";

const BANNED_METHODS = new Set([
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleString",
  "toISOString",
]);

/**
 * All date rendering and wire formatting must go through the shared date
 * utilities (`src/utils/date-format.ts` on the display side; explicit
 * `.toISOString()` mappings belong in server services, not client code).
 * Raw `Date` formatting in components is how the "Invalid time value" and
 * locale-mismatch bugs happened.
 */
export const noRawDateFormattingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw Date formatting calls (toLocale*, toISOString) in UI code; use the shared date utilities instead.",
    },
    messages: {
      rawDateFormatting:
        "Do not format dates inline. Use `formatDateUtc` from `src/utils/date-format.ts` (or move `toISOString` mappings into the server service).",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        if (callee.computed || callee.property.type !== "Identifier") return;
        if (!BANNED_METHODS.has(callee.property.name)) return;
        context.report({ node, messageId: "rawDateFormatting" });
      },
    };
  },
});
