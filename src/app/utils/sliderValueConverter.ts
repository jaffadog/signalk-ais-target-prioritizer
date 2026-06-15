// slider utils

const zeroToTenValues = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

const tcpaValues = [1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 60];

export function zeroToTenToSlider(val: number) {
  return [zeroToTenValues.indexOf(val)];
}

export function sliderToZeroToTen(idx: number) {
  return zeroToTenValues[idx];
}

export function tcpaToSlider(val: number) {
  return [tcpaValues.indexOf(val)];
}

export function sliderToTcpa(idx: number) {
  return tcpaValues[idx];
}
