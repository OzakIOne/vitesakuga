import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { nextLocalMidnight, startOfLocalDay } from "./local-day";

// A zone with both transitions, so DST correctness is pinned against real
// zone rules rather than the machine's timezone.
const NEW_YORK = DateTime.zoneMakeNamedUnsafe("America/New_York");

describe("startOfLocalDay", () => {
  it("returns local midnight on a normal day", () => {
    // 2024-06-15 10:00 EDT == 14:00:00Z; that day's midnight == 04:00:00Z.
    expect(startOfLocalDay(Date.parse("2024-06-15T14:00:00Z"), NEW_YORK)).toBe(
      Date.parse("2024-06-15T04:00:00Z"),
    );
  });

  it("survives the spring-forward transition (offset differs between now and midnight)", () => {
    // 2024-03-10 10:00 EDT == 14:00:00Z; that day's midnight was EST ==
    // 05:00:00Z. The flawed wall-fields arithmetic would yield 04:00:00Z.
    expect(startOfLocalDay(Date.parse("2024-03-10T14:00:00Z"), NEW_YORK)).toBe(
      Date.parse("2024-03-10T05:00:00Z"),
    );
  });

  it("survives the fall-back transition", () => {
    // 2024-11-03 01:30 EST == 06:30:00Z; that day's midnight was EDT ==
    // 04:00:00Z. The flawed wall-fields arithmetic would yield 05:00:00Z.
    expect(startOfLocalDay(Date.parse("2024-11-03T06:30:00Z"), NEW_YORK)).toBe(
      Date.parse("2024-11-03T04:00:00Z"),
    );
  });
});

describe("nextLocalMidnight", () => {
  it("spans exactly 24 hours on a normal day", () => {
    // Midnight of 2024-06-15 == 04:00:00Z; midnight of 2024-06-16 == 04:00:00Z.
    expect(
      nextLocalMidnight(Date.parse("2024-06-15T14:00:00Z"), NEW_YORK),
    ).toBe(Date.parse("2024-06-16T04:00:00Z"));
  });

  it("spans only 23 hours across a spring-forward midnight-to-midnight day", () => {
    // Midnight of 2024-03-10 was EST == 05:00:00Z; midnight of 2024-03-11 is
    // EDT == 04:00:00Z — one hour short of 24.
    expect(
      nextLocalMidnight(Date.parse("2024-03-10T14:00:00Z"), NEW_YORK),
    ).toBe(Date.parse("2024-03-11T04:00:00Z"));
  });

  it("spans 25 hours across a fall-back midnight-to-midnight day", () => {
    // Midnight of 2024-11-03 was EDT == 04:00:00Z; midnight of 2024-11-04 is
    // EST == 05:00:00Z — one hour more than 24.
    expect(
      nextLocalMidnight(Date.parse("2024-11-03T06:30:00Z"), NEW_YORK),
    ).toBe(Date.parse("2024-11-04T05:00:00Z"));
  });
});
