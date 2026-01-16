import { CGMinerAPI, CGMinerAPIResult, kDefaultPort } from './cg-miner-api';
import type {
  CGMinerSummaryItem,
  CGMinerPoolItem,
  CGMinerEDevItem,
  CGMinerEStatsItem,
} from './cgminer-types';

export interface CGMinerClientOptions {
  host: string;
  port?: number;
  firstTimeout?: number;
  retry?: number;
}

/**
 * Instance-oriented CGMiner client.
 *
 * This is a convenience wrapper around the static CGMinerAPI functions that lets
 * callers configure defaults once (host/port/timeouts/retry/cancel).
 */
export class CGMinerClient {
  readonly host: string;
  readonly port: number;
  readonly firstTimeout: number;
  readonly retry: number;

  constructor(opts: CGMinerClientOptions) {
    this.host = opts.host;
    this.port = opts.port ?? kDefaultPort;
    this.firstTimeout = opts.firstTimeout ?? CGMinerAPI.defaultFirstTimeout;
    this.retry = opts.retry ?? 0;
  }

  async version(): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.aioVersion(this.host, this.port, this.firstTimeout, this.retry);
  }

  async summary(): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.summary(this.host, this.port, this.firstTimeout, this.retry);
  }

  async pools(): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.pools(this.host, this.port, this.firstTimeout, this.retry);
  }

  async edevs(): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.edevs(this.host, this.port, this.firstTimeout, this.retry);
  }

  async estats(): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.estats(this.host, this.port, this.firstTimeout, this.retry);
  }

  async addPool(url: string, user: string, password: string = ''): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.addPool(this.host, url, user, password, this.port, this.firstTimeout, this.retry);
  }

  async removePool(poolIndex: number): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.removePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async switchPool(poolIndex: number): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.switchPool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async enablePool(poolIndex: number): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.enablePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async disablePool(poolIndex: number): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.disablePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async config(config: string = ''): Promise<CGMinerAPIResult> {
    return await CGMinerAPI.config(this.host, config, this.port, this.firstTimeout, this.retry);
  }

  // Typed convenience helpers
  async summaryTyped(): Promise<CGMinerSummaryItem[] | null> {
    const r = await this.summary();
    return r.summaryTyped();
  }

  async poolsTyped(): Promise<CGMinerPoolItem[] | null> {
    const r = await this.pools();
    return r.poolsTyped();
  }

  async edevsTyped(): Promise<CGMinerEDevItem[] | null> {
    const r = await this.edevs();
    return r.edevsTyped();
  }

  async estatsTyped(): Promise<CGMinerEStatsItem[] | null> {
    const r = await this.estats();
    return r.estatsTyped();
  }
}

