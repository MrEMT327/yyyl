// Layout positions and widths from chapter 1 s_map0017_2 (Unity X/Z units).
// Only placement/motion data is reused. Every texture is original project art.
// Rows: [sprite key, center X, center Z, width]. Heights follow our own PNG aspect.
export const STAGE1_CLOUD_MODULES = Object.freeze({
  3: Object.freeze([
    Object.freeze(["cloudSmallA", 8.66, -27.74, 4.29]),
    Object.freeze(["cloudSmallA", 0.4, 96.1, 2.98]),
    Object.freeze(["cloudSmallB", -11.38, -56.33, 3.5338]),
    Object.freeze(["cloudSmallB", 6.22, 36.47, 3.5338]),
    Object.freeze(["cloudSmallA", 2.16, 9.46, 4.29]),
    Object.freeze(["cloudSmallA", -6.91, 81.19, 4.29]),
    Object.freeze(["cloudSmallA", -9.12, 80.42, 2.98]),
    Object.freeze(["cloudSmallB", 0.52, 92.97, 3.5338]),
    Object.freeze(["cloudSmallA", -1.05, -46.88, 2.98]),
    Object.freeze(["cloudSmallA", 1.76, 94.66, 4.29]),
    Object.freeze(["cloudSmallA", 9.08, -90.68, 2.98]),
    Object.freeze(["cloudSmallA", -12.72, -55.48, 2.98]),
    Object.freeze(["cloudSmallB", -7.78, 79.57, 3.5338]),
    Object.freeze(["cloudSmallA", 11.54, -93.66, 2.98]),
    Object.freeze(["cloudSmallA", 1.59, -46.51, 4.29]),
    Object.freeze(["cloudSmallA", -5.23, 82.78, 2.98]),
    Object.freeze(["cloudSmallA", -3.31, -69.51, 4.29]),
    Object.freeze(["cloudSmallB", 1.84, -50.1, 2.54]),
    Object.freeze(["cloudSmallB", 10.42, -91.53, 3.5338]),
    Object.freeze(["cloudSmallB", 0.72, -48.13, 3.5338]),
    Object.freeze(["cloudSmallA", 2.95, 92.05, 2.98]),
    Object.freeze(["cloudSmallB", 7.42, -29.43, 3.5338]),
    Object.freeze(["cloudSmallA", 0.8, 10.9, 2.98]),
    Object.freeze(["cloudSmallA", -5.52, -70.28, 2.98]),
    Object.freeze(["cloudSmallA", 8.65, 35.55, 2.98]),
    Object.freeze(["cloudSmallA", 12.97, -88.32, 2.98]),
    Object.freeze(["cloudSmallA", -6.66, 77.44, 2.98]),
    Object.freeze(["cloudSmallA", -1.63, -67.92, 2.98]),
    Object.freeze(["cloudSmallA", -10.26, -58.46, 2.98]),
    Object.freeze(["cloudSmallA", -3.06, -73.26, 2.98]),
    Object.freeze(["cloudSmallB", -4.18, -71.13, 3.5338]),
    Object.freeze(["cloudSmallA", 7.3, -26.3, 2.98]),
    Object.freeze(["cloudSmallA", 3.35, 6.85, 2.98]),
    Object.freeze(["cloudSmallA", 6.1, 39.6, 2.98]),
    Object.freeze(["cloudSmallA", 9.85, -30.35, 2.98]),
    Object.freeze(["cloudSmallA", -10.51, -54.71, 4.29]),
    Object.freeze(["cloudSmallA", 11.29, -89.91, 4.29]),
    Object.freeze(["cloudSmallA", 0.6, -45.0, 2.98]),
    Object.freeze(["cloudSmallB", 0.92, 7.77, 3.5338]),
    Object.freeze(["cloudSmallA", 7.46, 38.16, 4.29]),
  ]),
  2: Object.freeze([
    Object.freeze(["cloudLargeB", 6.9, -50.3, 13.1952]),
    Object.freeze(["cloudLargeA", 13.3, 71.9, 15.735]),
    Object.freeze(["cloudLargeA", 8.2, 0.3, 15.735]),
    Object.freeze(["cloudLargeB", -2.2, 91.1, 8.7968]),
    Object.freeze(["cloudLargeA", 13.3, -67.8, 10.3425]),
    Object.freeze(["cloudLargeB", -9.9, 27.5, 13.1952]),
    Object.freeze(["cloudLargeA", -8.8, -87.0, 16.784]),
    Object.freeze(["cloudLargeA", 1.5, 49.5, 10.3425]),
    Object.freeze(["cloudLargeA", -9.43, -26.88, 10.3425]),
    Object.freeze(["cloudLargeB", -13.36, 74.33, 13.1952]),
  ]),
  5: Object.freeze([
    Object.freeze(["cloudLargeB", 11.9, 57.5, 17.5936]),
    Object.freeze(["cloudLargeA", -11.7, -57.6, 13.79]),
    Object.freeze(["cloudLargeA", 15.2, -82.8, 20.98]),
    Object.freeze(["cloudLargeB", 15.1, -30.8, 17.5936]),
    Object.freeze(["cloudLargeA", -11.8, -0.7, 20.98]),
    Object.freeze(["cloudLargeA", 13.8, 24.2, 13.79]),
    Object.freeze(["cloudLargeB", -10.6, 83.6, 17.5936]),
  ]),
});

export const STAGE1_CLOUD_SPRITES = Object.freeze({
  cloudSmallA: Object.freeze({width:256,height:256}),
  cloudSmallB: Object.freeze({width:256,height:256}),
  cloudLargeA: Object.freeze({width:768,height:768}),
  cloudLargeB: Object.freeze({width:768,height:768}),
  cloudBank: Object.freeze({width:768,height:768}),
});

// Authored altitude composition. Native assets are never used. Large, offset
// masses pass through different parts of the view instead of outlining banks.
export const STAGE1_COAST_CLOUDS = Object.freeze({
  far: Object.freeze([
    ['cloudLargeB',-10.8,2,16], ['cloudLargeA',11.5,38,18],
    ['cloudLargeA',-11.2,76,16], ['cloudLargeB',11.4,-88,17],
    ['cloudLargeA',-10.3,-52,18], ['cloudLargeB',11.5,-20,16],
  ].map(Object.freeze)),
  2: Object.freeze([
    ['cloudBank',-14.5,-9,22], ['cloudLargeB',13.1,43,12],
    ['cloudBank',14.8,92,21], ['cloudLargeA',-13.8,-64,12],
  ].map(Object.freeze)),
  5: Object.freeze([
    ['cloudBank',14.5,7,24], ['cloudLargeA',-14.8,42,19],
    ['cloudLargeB',13.5,79,19], ['cloudLargeA',-12.4,-85,21],
    ['cloudLargeB',14.5,-48,18], ['cloudLargeA',-13.7,-20,19],
  ].map(Object.freeze)),
});
