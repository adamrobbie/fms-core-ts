import { CGMinerAPI, CGMinerAPIResult, kDefaultPort } from './cg-miner-api';
import type {
  CGMinerSummaryItem,
  CGMinerPoolItem,
  CGMinerDevItem,
  CGMinerEDevItem,
  CGMinerEStatsItem,
} from './cgminer-types';

export interface CGMinerClientOptions {
  host: string;
  port?: number;
  firstTimeout?: number;
  retry?: number;
  signal?: AbortSignal;
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
  readonly signal?: AbortSignal;

  constructor(opts: CGMinerClientOptions) {
    this.host = opts.host;
    this.port = opts.port ?? kDefaultPort;
    this.firstTimeout = opts.firstTimeout ?? CGMinerAPI.defaultFirstTimeout;
    this.retry = opts.retry ?? 0;
    this.signal = opts.signal;
  }

  /**
   * Check if operation should be cancelled due to AbortSignal.
   * Throws an error if signal is aborted.
   */
  private checkCancelled(): void {
    if (this.signal?.aborted) {
      throw new Error('Operation cancelled');
    }
  }

  async version(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.aioVersion(this.host, this.port, this.firstTimeout, this.retry);
  }

  async summary(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.summary(this.host, this.port, this.firstTimeout, this.retry);
  }

  async devs(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.devs(this.host, this.port, this.firstTimeout, this.retry);
  }

  async pools(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.pools(this.host, this.port, this.firstTimeout, this.retry);
  }

  async edevs(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.edevs(this.host, this.port, this.firstTimeout, this.retry);
  }

  async estats(): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.estats(this.host, this.port, this.firstTimeout, this.retry);
  }

  async addPool(url: string, user: string, password: string = ''): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.addPool(this.host, url, user, password, this.port, this.firstTimeout, this.retry);
  }

  async removePool(poolIndex: number): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.removePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async switchPool(poolIndex: number): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.switchPool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async enablePool(poolIndex: number): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.enablePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async disablePool(poolIndex: number): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.disablePool(this.host, poolIndex, this.port, this.firstTimeout, this.retry);
  }

  async config(config: string = ''): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.config(this.host, config, this.port, this.firstTimeout, this.retry);
  }

  async rebootMm3(lastWhen: number = 0): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.rebootMm3(this.host, lastWhen, this.port, this.firstTimeout, this.retry);
  }

  async mm3SetWorkmode(workmode: string): Promise<CGMinerAPIResult> {
    this.checkCancelled();
    return await CGMinerAPI.mm3SetWorkmode(this.host, workmode, this.port, this.firstTimeout, this.retry);
  }

  // Typed convenience helpers
  async summaryTyped(): Promise<CGMinerSummaryItem[] | null> {
    const r = await this.summary();
    return r.summaryTyped();
  }

  async devsTyped(): Promise<CGMinerDevItem[] | null> {
    const r = await this.devs();
    return r.devsTyped();
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

