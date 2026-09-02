/**
 * The fit engine. Pure functions over the domain types - no React, no browser
 * APIs, no network. See docs/app-architecture.md section 3 for the layering.
 *
 *   forward.ts      frame + cockpit -> contact points
 *   solve.ts        closed-form inverse, six evaluations, no search
 *   assumptions.ts  resolves documented defaults into a concrete cockpit
 *   accufit.ts      enumerates buildable cockpits, after Wilier's Accufit tables
 *   score.ts        penalties -> score, verdict, flags
 *   saddle.ts       seatpost and rail feasibility gate
 *   attribute.ts    one-at-a-time delta attribution
 *   phrases.ts      generated comparison language
 *   explain.ts      clause assembly
 */

export * from './forward';
export * from './solve';
export * from './assumptions';
export * from './accufit';
export * from './score';
export * from './saddle';
export * from './attribute';
export * from './phrases';
export * from './explain';
