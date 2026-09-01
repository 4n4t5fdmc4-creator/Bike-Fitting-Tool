/**
 * The fit engine. Pure functions over the domain types - no React, no browser
 * APIs, no network. See docs/app-architecture.md section 3 for the layering.
 *
 *   forward.ts      frame + cockpit -> contact points
 *   solve.ts        closed-form inverse, six evaluations, no search
 *   assumptions.ts  resolves documented defaults into a concrete cockpit
 *   score.ts        penalties -> score, verdict, flags
 *   saddle.ts       seatpost and rail feasibility gate
 *   attribute.ts    one-at-a-time delta attribution
 *   phrases.ts      generated comparison language
 *   explain.ts      clause assembly
 */

export * from './forward.js';
export * from './solve.js';
export * from './assumptions.js';
export * from './score.js';
export * from './saddle.js';
export * from './attribute.js';
export * from './phrases.js';
export * from './explain.js';
