#!/usr/bin/env npx ts-node

/**
 * Get Miner Info Example
 * 
 * Retrieves comprehensive information from a CGMiner-compatible miner:
 * - Version info
 * - Summary (hashrate, shares)
 * - Pool configuration
 * - Device information
 * - Extended statistics
 * 
 * Usage:
 *   MINER_IP=192.168.1.100 npx ts-node examples/get-miner-info.ts
 */

import { CGMinerAPI } from '../src';

const MINER_IP = process.env.MINER_IP || '192.168.1.100';
const MINER_PORT = parseInt(process.env.MINER_PORT || '4028', 10);

async function main() {
  console.log(`Fetching info from ${MINER_IP}:${MINER_PORT}...\n`);

  try {
    // Fetch all data in parallel for efficiency
    const [versionResult, summaryResult, poolsResult, edevsResult, estatsResult] = await Promise.all([
      CGMinerAPI.aioVersion(MINER_IP, MINER_PORT),
      CGMinerAPI.summary(MINER_IP, MINER_PORT),
      CGMinerAPI.pools(MINER_IP, MINER_PORT),
      CGMinerAPI.edevs(MINER_IP, MINER_PORT),
      CGMinerAPI.estats(MINER_IP, MINER_PORT),
    ]);

    // Version Info
    console.log('═══════════════════════════════════════');
    console.log('  VERSION INFO');
    console.log('═══════════════════════════════════════');
    if (versionResult.isRequestSuccess()) {
      console.log(`  Software:  ${versionResult.mm3SoftwareVersion() || 'N/A'}`);
      console.log(`  MAC:       ${versionResult.mm3Mac() || 'N/A'}`);
      console.log(`  Model:     ${versionResult.mm3Model() || 'N/A'}`);
      console.log(`  HW Type:   ${versionResult.mm3HardwareType() || 'N/A'}`);
    } else {
      console.log(`  Error: ${versionResult.msg}`);
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('  MINING SUMMARY');
    console.log('═══════════════════════════════════════');
    if (summaryResult.isRequestSuccess()) {
      const summary = summaryResult.summaryTyped();
      if (summary && summary.length > 0) {
        const s = summary[0];
        console.log(`  Hash Rate (5s):   ${s['GHS 5s'] ?? 'N/A'} GH/s`);
        console.log(`  Hash Rate (avg):  ${s['GHS av'] ?? 'N/A'} GH/s`);
        console.log(`  Accepted:         ${s.Accepted ?? 'N/A'}`);
        console.log(`  Rejected:         ${s.Rejected ?? 'N/A'}`);
        console.log(`  Hardware Errors:  ${s['Hardware Errors'] ?? 'N/A'}`);
        console.log(`  Uptime:           ${s.Elapsed ? `${Math.floor(s.Elapsed / 3600)}h ${Math.floor((s.Elapsed % 3600) / 60)}m` : 'N/A'}`);
      }
    } else {
      console.log(`  Error: ${summaryResult.msg}`);
    }

    // Pools
    console.log('\n═══════════════════════════════════════');
    console.log('  POOLS');
    console.log('═══════════════════════════════════════');
    if (poolsResult.isRequestSuccess()) {
      const pools = poolsResult.poolsTyped();
      if (pools && pools.length > 0) {
        pools.forEach((pool, i) => {
          const status = pool.Status === 'Alive' ? '🟢' : '🔴';
          console.log(`  ${status} Pool ${i}: ${pool.URL || 'N/A'}`);
          console.log(`     User: ${pool.User || 'N/A'}`);
          console.log(`     Status: ${pool.Status || 'N/A'}, Priority: ${pool.Priority ?? 'N/A'}`);
          console.log(`     Accepted: ${pool.Accepted ?? 0}, Rejected: ${pool.Rejected ?? 0}`);
        });
      } else {
        console.log('  No pools configured');
      }
    } else {
      console.log(`  Error: ${poolsResult.msg}`);
    }

    // Extended Devices
    console.log('\n═══════════════════════════════════════');
    console.log('  DEVICES');
    console.log('═══════════════════════════════════════');
    if (edevsResult.isRequestSuccess()) {
      const edevs = edevsResult.edevsTyped();
      if (edevs && edevs.length > 0) {
        edevs.forEach((dev, i) => {
          console.log(`  Device ${dev.ASC ?? i}:`);
          console.log(`     Name: ${dev.Name || 'N/A'}`);
          console.log(`     Status: ${dev.Status || 'N/A'}`);
          console.log(`     Temperature: ${dev.Temperature ?? 'N/A'}°C`);
          console.log(`     Hash Rate: ${dev['GHS 5s'] ?? dev['MHS 5s'] ?? 'N/A'} GH/s`);
        });
      } else {
        console.log('  No device info available');
      }
    } else {
      console.log(`  Error: ${edevsResult.msg}`);
    }

    // Extended Stats (brief)
    console.log('\n═══════════════════════════════════════');
    console.log('  EXTENDED STATS');
    console.log('═══════════════════════════════════════');
    if (estatsResult.isRequestSuccess()) {
      const estats = estatsResult.estatsTyped();
      if (estats && estats.length > 0) {
        console.log(`  Found ${estats.length} stats entries`);
        // Just show that we got data - full stats can be very verbose
        const firstStat = estats[0];
        if (firstStat) {
          const keys = Object.keys(firstStat).slice(0, 5);
          keys.forEach(key => {
            console.log(`     ${key}: ${(firstStat as Record<string, unknown>)[key]}`);
          });
          if (Object.keys(firstStat).length > 5) {
            console.log(`     ... and ${Object.keys(firstStat).length - 5} more fields`);
          }
        }
      } else {
        console.log('  No extended stats available');
      }
    } else {
      console.log(`  Error: ${estatsResult.msg}`);
    }

    console.log('\n═══════════════════════════════════════\n');

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
