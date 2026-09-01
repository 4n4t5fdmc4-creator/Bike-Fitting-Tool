/**
 * Domain model for the Bike Fitting Tool.
 *
 * Reading order:
 *   units.ts       branded units, BB-relative coordinates, data provenance
 *   rider.ts       body, flexibility, style, ideal fit profile
 *   geometry.ts    frame geometry, sizes, models, the owned bike
 *   components.ts  stems, bars, posts, saddles, spacers, cockpit setup
 *   fit.ts         contact points, candidates, targets, documented assumptions
 *   scoring.ts     gates, sub-scores, delta attribution, explanation
 *   validation.ts  plausibility bounds, cross-field rules, default assumptions
 */

export * from './units.js';
export * from './rider.js';
export * from './geometry.js';
export * from './components.js';
export * from './fit.js';
export * from './scoring.js';
export * from './validation.js';
