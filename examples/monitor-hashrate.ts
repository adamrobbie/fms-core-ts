/**
 * Hashrate Monitor Example
 * 
 * Polls miner at regular intervals and displays hashrate.
 * Press Ctrl+C to stop.
 * 
 * Usage:
 *   MINER_IP=192.168.1.100 npx ts-node examples/monitor-hashrate.ts
 * 
 * Environment:
 *   MINER_IP      - Miner IP address (default: 192.168.1.100)
 *   MINER_PORT    - Miner port (default: 4028)
 *   POLL_INTERVAL - Seconds between polls (default: 10)
 */

import { CGMinerAPI } from '../src';

const MINER_IP = process.env.MINER_IP || '192.168.1.100';
const MINER_PORT = parseInt(process.env.MINER_PORT || '4028', 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10', 10) * 1000;

let running = true;

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nStopping monitor...');
  running = false;
});

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readFirstNumericField(
  obj: Record<string, unknown>,
  keys: string[]
): { value?: number; key?: string } {
  for (const k of keys) {
    const v = toNumber(obj[k]);
    if (v !== undefined) return { value: v, key: k };
  }
  return {};
}

function formatHashrate(value: number | undefined, unit: string): string {
  if (value === undefined) return 'N/A';
  // Best-effort: if already in GH/s we can scale to TH/s for readability
  if (unit === 'GH/s' && value >= 1000) return `${(value / 1000).toFixed(2)} TH/s`;
  return `${value.toFixed(2)} ${unit}`;
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

async function poll(): Promise<void> {
  const timestamp = new Date().toLocaleTimeString();
  
  try {
    const result = await CGMinerAPI.summary(MINER_IP, MINER_PORT, 5, 0);
    
    if (result.isRequestSuccess()) {
      const summary = result.summaryTyped();
      if (summary && summary.length > 0) {
        const s = summary[0] as unknown as Record<string, unknown>;
        const hashrate5s = readFirstNumericField(s, ['GHS 5s', 'MHS 5s', 'KHS 5s']);
        const hashrateAvg = readFirstNumericField(s, ['GHS av', 'MHS av', 'KHS av']);
        const unit5s =
          hashrate5s.key?.startsWith('GHS') ? 'GH/s' : hashrate5s.key?.startsWith('MHS') ? 'MH/s' : hashrate5s.key?.startsWith('KHS') ? 'KH/s' : 'H/s';
        const unitAvg =
          hashrateAvg.key?.startsWith('GHS') ? 'GH/s' : hashrateAvg.key?.startsWith('MHS') ? 'MH/s' : hashrateAvg.key?.startsWith('KHS') ? 'KH/s' : 'H/s';

        const accepted = toNumber(s['Accepted']) ?? 0;
        const rejected = toNumber(s['Rejected']) ?? 0;
        const hwErrors = toNumber(s['Hardware Errors']) ?? 0;
        const uptime = toNumber(s['Elapsed']);
        
        // Calculate rejection rate
        const total = accepted + rejected;
        const rejectRate = total > 0 ? ((rejected / total) * 100).toFixed(2) : '0.00';
        
        console.log(
          `[${timestamp}] ` +
          `Hash: ${formatHashrate(hashrate5s.value, unit5s)} (avg: ${formatHashrate(hashrateAvg.value, unitAvg)}) | ` +
          `Shares: ${accepted}/${rejected} (${rejectRate}% rej) | ` +
          `HW Err: ${hwErrors} | ` +
          `Uptime: ${formatUptime(uptime)}`
        );
      } else {
        console.log(`[${timestamp}] No summary data`);
      }
    } else {
      console.log(`[${timestamp}] ❌ Error: ${result.msg || 'Connection failed'}`);
    }
  } catch (error) {
    console.log(`[${timestamp}] ❌ Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Hashrate Monitor');
  console.log(`  Miner: ${MINER_IP}:${MINER_PORT}`);
  console.log(`  Poll Interval: ${POLL_INTERVAL / 1000}s`);
  console.log('  Press Ctrl+C to stop');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Initial poll
  await poll();

  // Continue polling while running
  while (running) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    if (running) {
      await poll();
    }
  }

  console.log('Monitor stopped.');
}

main();
