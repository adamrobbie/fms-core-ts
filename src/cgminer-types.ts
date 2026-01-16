/**
 * Minimal type definitions for common CGMiner API payloads.
 *
 * CGMiner payload schemas vary across miner vendors and firmware versions, so these
 * types are intentionally permissive and include an index signature.
 */

export interface CGMinerSummaryItem {
  Elapsed?: number;
  Accepted?: number;
  Rejected?: number;
  // Common hashrate fields across variants
  'GHS 5s'?: number;
  'GHS av'?: number;
  'MHS 5s'?: number;
  'MHS av'?: number;
  [key: string]: unknown;
}

export interface CGMinerPoolItem {
  URL?: string;
  Status?: string;
  Priority?: number;
  User?: string;
  [key: string]: unknown;
}

export interface CGMinerDevItem {
  ID?: number;
  Enabled?: string | boolean;
  Status?: string;
  Temperature?: number;
  'MHS 5s'?: number;
  'MHS av'?: number;
  [key: string]: unknown;
}

export interface CGMinerEDevItem {
  ID?: number;
  Status?: string;
  Temperature?: number;
  [key: string]: unknown;
}

export interface CGMinerEStatsItem {
  [key: string]: unknown;
}

