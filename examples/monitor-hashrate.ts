#!/usr/bin/env npx ts-node

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

function formatHashrate(ghs: number | undefined): string {
  if (ghs === undefined || ghs === null) return 'N/A';
  if (ghs >= 1000) return `${(ghs / 1000).toFixed(2)} TH/s`;
  return `${ghs.toFixed(2)} GH/s`;
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
        const s = summary[0];
        const hashrate5s = s['GHS 5s'];
        const hashrateAvg = s['GHS av'];
        const accepted = s.Accepted ?? 0;
        const rejected = s.Rejected ?? 0;
        const hwErrors = s['Hardware Errors'] ?? 0;
        const uptime = s.Elapsed;
        
        // Calculate rejection rate
        const total = accepted + rejected;
        const rejectRate = total > 0 ? ((rejected / total) * 100).toFixed(2) : '0.00';
        
        console.log(
          `[${timestamp}] ` +
          `Hash: ${formatHashrate(hashrate5s)} (avg: ${formatHashrate(hashrateAvg)}) | ` +
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
