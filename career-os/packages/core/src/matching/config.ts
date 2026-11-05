/**
 * Matching configuration.
 *
 * The weights are a transparent, hand-set starting point — NOT a statistically
 * validated model. They express relative importance and are re-normalised over
 * the components that can actually be evaluated for a given job, so a missing
 * salary never counts as zero and never counts as a match either.
 */

export type ComponentKey =
  | 'technical'
  | 'experience'
  | 'area'
  | 'seniority'
  | 'location'
  | 'language'
  | 'career'
  | 'compensation';

export interface MatchingConfig {
  version: string;
  weights: Record<ComponentKey, number>;
  /** Weight of a must-have requirement relative to a nice-to-have one. */
  mustWeight: number;
  niceWeight: number;
  /** Points removed from the overall score per unmet must-have skill / certification / education. */
  missingMustPenalty: number;
  /** Category thresholds on the overall score (applied only when no hard gate fires). */
  thresholds: { excellent: number; high: number; moderate: number };
  /** Priority given to a country absent from the user's preferences (open to exceptional offers). */
  defaultCountryPriority: number;
  /** Priority given to an area absent from the user's preferences. */
  defaultAreaPriority: number;
  /** Rough EUR conversion for comparing published salaries with the user's floor. */
  eurRates: Record<string, number>;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  version: '2026.11-1',
  weights: {
    technical: 30,
    experience: 10,
    area: 15,
    seniority: 10,
    location: 10,
    language: 10,
    career: 10,
    compensation: 5,
  },
  mustWeight: 2,
  niceWeight: 1,
  missingMustPenalty: 8,
  thresholds: { excellent: 80, high: 65, moderate: 50 },
  defaultCountryPriority: 0.3,
  defaultAreaPriority: 0.2,
  eurRates: { EUR: 1, BRL: 0.17, USD: 0.92, AUD: 0.6, GBP: 1.17, CHF: 1.05 },
};

/** Merge a partial override (e.g. from YAML/JSON) into the defaults. */
export function resolveConfig(override?: Partial<MatchingConfig>): MatchingConfig {
  if (!override) return DEFAULT_MATCHING_CONFIG;
  return {
    ...DEFAULT_MATCHING_CONFIG,
    ...override,
    weights: { ...DEFAULT_MATCHING_CONFIG.weights, ...(override.weights ?? {}) },
    thresholds: { ...DEFAULT_MATCHING_CONFIG.thresholds, ...(override.thresholds ?? {}) },
    eurRates: { ...DEFAULT_MATCHING_CONFIG.eurRates, ...(override.eurRates ?? {}) },
  };
}
