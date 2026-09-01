import type { Millimeters } from './units.js';
import { deg } from './units.js';
// Degrees must not be assignable to Millimeters - if this compiles, the
// branded units are not doing their job and CI is not really checking.
export const broken: Millimeters = deg(73);
