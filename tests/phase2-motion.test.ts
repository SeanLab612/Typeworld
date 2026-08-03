import {describe, expect, it} from "vitest";
import {MECHANISM_DURATION_MS, sampleMechanismPose} from "../src/phase2-motion";

describe("Phase 2 mechanism pose", () => {
  it("starts and ends with all reciprocating parts at rest", () => {
    expect(sampleMechanismPose(0)).toMatchObject({
      keyPress: 0,
      linkageTravel: 0,
      typebarStrike: 0,
      ribbonLift: 0,
      carriageAdvance: 0,
    });
    expect(sampleMechanismPose(MECHANISM_DURATION_MS)).toMatchObject({
      keyPress: 0,
      linkageTravel: 0,
      typebarStrike: 0,
      ribbonLift: 0,
      carriageAdvance: 1,
    });
  });

  it("reaches one deterministic typebar strike peak", () => {
    const strike = sampleMechanismPose(MECHANISM_DURATION_MS * 0.38);

    expect(strike.typebarStrike).toBeCloseTo(1, 5);
    expect(strike.ribbonLift).toBeGreaterThan(0.8);
    expect(strike.carriageAdvance).toBe(0);
  });

  it("advances the carriage only after the typebar returns", () => {
    const advancing = sampleMechanismPose(MECHANISM_DURATION_MS * 0.82);

    expect(advancing.typebarStrike).toBe(0);
    expect(advancing.keyPress).toBe(0);
    expect(advancing.carriageAdvance).toBeGreaterThan(0);
  });
});
