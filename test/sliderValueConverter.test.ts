import { describe, it, expect } from "vitest";

import {
  sliderToTcpa,
  sliderToZeroToTen,
  tcpaToSlider,
  zeroToTenToSlider,
} from "../src/app/utils/sliderValueConverter";

// the sliders step through a fixed list of values rather than a linear range, so
// these converters map between a stored value and its index in that list

describe("zeroToTen slider", () => {
  it("round trips every value on the scale", () => {
    const values = [
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      10,
    ];
    for (const value of values) {
      const [index] = zeroToTenToSlider(value);
      expect(sliderToZeroToTen(index)).toBe(value);
    }
  });

  it("packs the index in an array, as the slider component expects", () => {
    expect(zeroToTenToSlider(0)).toEqual([0]);
    expect(zeroToTenToSlider(10)).toEqual([19]);
  });

  it("is finer below 1 than above it", () => {
    // 0 -> 1 takes ten steps, 1 -> 10 takes nine
    expect(zeroToTenToSlider(1)[0]).toBe(10);
    expect(zeroToTenToSlider(10)[0]).toBe(19);
  });

  it("reports -1 for a value that is not on the scale", () => {
    expect(zeroToTenToSlider(0.15)).toEqual([-1]);
    expect(zeroToTenToSlider(11)).toEqual([-1]);
  });

  it("is undefined outside the index range", () => {
    expect(sliderToZeroToTen(20)).toBeUndefined();
    expect(sliderToZeroToTen(-1)).toBeUndefined();
  });
});

describe("tcpa slider", () => {
  it("round trips every value on the scale", () => {
    for (const value of [1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 60]) {
      const [index] = tcpaToSlider(value);
      expect(sliderToTcpa(index)).toBe(value);
    }
  });

  it("starts at one minute and ends at an hour", () => {
    expect(sliderToTcpa(0)).toBe(1);
    expect(tcpaToSlider(60)).toEqual([11]);
  });

  it("steps by one up to five minutes, then coarser", () => {
    expect(sliderToTcpa(4)).toBe(5);
    expect(sliderToTcpa(5)).toBe(10);
  });

  it("reports -1 for a value that is not on the scale", () => {
    expect(tcpaToSlider(7)).toEqual([-1]);
    expect(tcpaToSlider(0)).toEqual([-1]);
  });

  it("is undefined outside the index range", () => {
    expect(sliderToTcpa(12)).toBeUndefined();
    expect(sliderToTcpa(-1)).toBeUndefined();
  });
});
