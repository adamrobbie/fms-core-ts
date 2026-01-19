#!/usr/bin/env npx ts-node

/**
 * Batch Query Example
 * 
 * Query multiple miners in parallel and display results in a table.
 * 
 * Usage:
 *   MINER_IPS="192.168.1.100,192.168.1.101,192.168.1.102" npx ts-node examples/batch-query.ts
 * 
 * Or configure miners directly in the script.
 */

import { CGMinerAPI } from '../src';

// Configure your miners here or use MINER_IPS environment variable
const DEFAULT_MINERS = [
  { name: 'Miner-01', ip: '192.168.1.100', port: 4028 },
  { name: 'Miner-02', ip: '192.168.1.101', port: 4028 },
  { name: 'Miner-03', ip: '192.168.1.102', port: 4028 },
];

interface MinerResult {
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'error';
  hashrate?: number;
  accepted?: number;
  rejected?: number;
  temperature?: number;
  uptime?: number;
  error?: string;
}

function getMiners(): Array<{ name: string; ip: string; port: number }> {
  const envIps = process.env.MINER_IPS;
  if (envIps) {
    return envIps.split(',').map((ip, i) => ({
      name: `Miner-${String(i + 1).padStart(2, '0')}`,
      ip: ip.trim(),
      port: 4028,
    }));
  }
  return DEFAULT_MINERS;
}

async function queryMiner(miner: { name: string; ip: string; port: number }): Promise<MinerResult> {
  const result: MinerResult = {
    name: miner.name,
    ip: miner.ip,
    status: 'offline',
  };

  try {
    // Query summary and edevs in parallel
    const [summaryResult, edevsResult] = await Promise.all([
      CGMinerAPI.summary(miner.ip, miner.port, 3, 0),
      CGMinerAPI.edevs(miner.ip, miner.port, 3, 0),
    ]);

    if (summaryResult.isRequestSuccess()) {
      result.status = 'online';
      const summary = summaryResult.summaryTyped();
      if (summary && summary.length > 0) {
        const s = summary[0];
        result.hashrate = s['GHS 5s'] ?? s['GHS av'];
        result.accepted = s.Accepted;
        result.rejected = s.Rejected;
        result.uptime = s.Elapsed;
      }
    } else {
      result.status = 'error';
      result.error = summaryResult.msg || 'Connection failed';
    }

    // Get temperature from edevs if available
    if (edevsResult.isRequestSuccess()) {
      const edevs = edevsResult.edevsTyped();
      if (edevs && edevs.length > 0) {
        // Get max temperature across all devices
        const temps = edevs
          .map(d => d.Temperature)
          .filter((t): t is number => typeof t === 'number');
        if (temps.length > 0) {
          result.temperature = Math.max(...temps);
        }
      }
    }
  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

function formatHashrate(ghs: number | undefined): string {
  if (ghs === undefined) return '-';
  if (ghs >= 1000) return `${(ghs / 1000).toFixed(1)} TH/s`;
  return `${ghs.toFixed(1)} GH/s`;
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function printTable(results: MinerResult[]): void {
  const header = '| Name       | IP              | Status  | Hashrate    | Accepted | Rejected | Temp  | Uptime |';
  const separator = '|------------|-----------------|---------|-------------|----------|----------|-------|--------|';

  console.log(separator);
  console.log(header);
  console.log(separator);

  let totalHashrate = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let onlineCount = 0;

  for (const r of results) {
    const status = r.status === 'online' ? '🟢 OK' : r.status === 'offline' ? '🔴 OFF' : '⚠️ ERR';
    const hashrate = formatHashrate(r.hashrate);
    const temp = r.temperature !== undefined ? `${r.temperature}°C` : '-';
    const uptime = formatUptime(r.uptime);

    console.log(
      `| ${r.name.padEnd(10)} | ${r.ip.padEnd(15)} | ${status.padEnd(7)} | ${hashrate.padStart(11)} | ${String(r.accepted ?? '-').padStart(8)} | ${String(r.rejected ?? '-').padStart(8)} | ${temp.padStart(5)} | ${uptime.padStart(6)} |`
    );

    if (r.status === 'online') {
      onlineCount++;
      totalHashrate += r.hashrate ?? 0;
      totalAccepted += r.accepted ?? 0;
      totalRejected += r.rejected ?? 0;
    }
  }

  console.log(separator);
  console.log(
    `| ${'TOTAL'.padEnd(10)} | ${`${onlineCount}/${results.length} online`.padEnd(15)} |         | ${formatHashrate(totalHashrate).padStart(11)} | ${String(totalAccepted).padStart(8)} | ${String(totalRejected).padStart(8)} |       |        |`
  );
  console.log(separator);
}

async function main() {
  const miners = getMiners();

  console.log('═══════════════════════════════════════════════════════════════════════════════════════');
  console.log('  Batch Miner Query');
  console.log(`  Querying ${miners.length} miner(s)...`);
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');

  // Filter out placeholder IPs
  const validMiners = miners.filter(m => 
    !m.ip.startsWith('192.168.1.10') || process.env.MINER_IPS
  );

  if (validMiners.length === 0) {
    console.log('No miners configured. Set MINER_IPS environment variable or edit the script.\n');
    console.log('Example:');
    console.log('  MINER_IPS="192.168.1.100,192.168.1.101" npx ts-node examples/batch-query.ts\n');
    process.exit(1);
  }

  // Query all miners in parallel
  const startTime = Date.now();
  const results = await Promise.all(validMiners.map(queryMiner));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  printTable(results);

  console.log(`\nQuery completed in ${elapsed}s\n`);

  // Show any errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(r => {
      console.log(`  ${r.name} (${r.ip}): ${r.error}`);
    });
    console.log('');
  }
}

main();
