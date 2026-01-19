#!/usr/bin/env npx ts-node

/**
 * Avalon Firmware Upgrade Example
 * 
 * Demonstrates how to upgrade firmware on Avalon miners using AUP files.
 * 
 * Usage:
 *   MINER_IP=192.168.1.100 FIRMWARE_FILE=./firmware.aup npx ts-node examples/avalon-upgrade.ts
 * 
 * ⚠️  WARNING: Firmware upgrades can brick your miner if interrupted!
 *     - Ensure stable network connection
 *     - Ensure stable power supply
 *     - Do not interrupt the upgrade process
 */

import * as fs from 'fs';
import { CGMinerAPI, upgradeFirmware } from '../src';

const MINER_IP = process.env.MINER_IP || '192.168.1.100';
const MINER_PORT = parseInt(process.env.MINER_PORT || '4028', 10);
const FIRMWARE_FILE = process.env.FIRMWARE_FILE || './firmware.aup';
const UPGRADE_TIMEOUT = parseInt(process.env.UPGRADE_TIMEOUT || '720', 10); // 12 minutes default

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Avalon Firmware Upgrade');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Miner:    ${MINER_IP}:${MINER_PORT}`);
  console.log(`  Firmware: ${FIRMWARE_FILE}`);
  console.log(`  Timeout:  ${UPGRADE_TIMEOUT}s`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check if firmware file exists
  if (!fs.existsSync(FIRMWARE_FILE)) {
    console.error(`❌ Firmware file not found: ${FIRMWARE_FILE}`);
    console.log('\nUsage:');
    console.log('  FIRMWARE_FILE=./path/to/firmware.aup npx ts-node examples/avalon-upgrade.ts\n');
    process.exit(1);
  }

  try {
    // Step 1: Check miner connectivity and get current version
    console.log('📡 Checking miner connectivity...');
    const versionResult = await CGMinerAPI.aioVersion(MINER_IP, MINER_PORT, 10, 2);
    
    if (!versionResult.isRequestSuccess()) {
      console.error(`❌ Cannot connect to miner: ${versionResult.msg}`);
      process.exit(1);
    }

    const currentVersion = versionResult.mm3SoftwareVersion() || 'Unknown';
    const model = versionResult.mm3Model() || 'Unknown';
    const mac = versionResult.mm3Mac() || 'Unknown';

    console.log('✅ Miner connected\n');
    console.log('Current Miner Info:');
    console.log(`  Model:   ${model}`);
    console.log(`  Version: ${currentVersion}`);
    console.log(`  MAC:     ${mac}\n`);

    // Step 2: Confirm upgrade
    console.log('⚠️  WARNING: Firmware upgrade in progress...');
    console.log('    Do NOT interrupt the process or power off the miner!\n');

    // Step 3: Start upgrade
    console.log('🔄 Starting firmware upgrade...\n');
    const startTime = Date.now();

    const [success, result] = await upgradeFirmware(
      MINER_IP,
      MINER_PORT,
      FIRMWARE_FILE,
      UPGRADE_TIMEOUT
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (success) {
      console.log(`\n✅ Firmware upgrade completed successfully in ${elapsed}s\n`);
      
      // Wait for miner to reboot and check new version
      console.log('⏳ Waiting for miner to reboot (60s)...');
      await new Promise(resolve => setTimeout(resolve, 60000));

      console.log('📡 Checking new version...');
      const newVersionResult = await CGMinerAPI.aioVersion(MINER_IP, MINER_PORT, 30, 5);
      
      if (newVersionResult.isRequestSuccess()) {
        const newVersion = newVersionResult.mm3SoftwareVersion() || 'Unknown';
        console.log(`✅ Miner is back online`);
        console.log(`   Previous version: ${currentVersion}`);
        console.log(`   New version:      ${newVersion}\n`);
      } else {
        console.log('⚠️  Could not verify new version (miner may still be rebooting)');
        console.log('   Try again in a few minutes.\n');
      }
    } else {
      console.error(`\n❌ Firmware upgrade failed after ${elapsed}s`);
      console.error('   Result:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Safety prompt
console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  ⚠️  FIRMWARE UPGRADE WARNING ⚠️                               ║');
console.log('║                                                               ║');
console.log('║  This script will upgrade your miner firmware.                ║');
console.log('║  Interrupting the process may BRICK your device!              ║');
console.log('║                                                               ║');
console.log('║  Ensure:                                                      ║');
console.log('║  • Stable network connection                                  ║');
console.log('║  • Stable power supply                                        ║');
console.log('║  • Correct firmware file for your miner model                 ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\n');

// Check for --yes flag to skip confirmation
if (process.argv.includes('--yes') || process.argv.includes('-y')) {
  main();
} else {
  console.log('To proceed, run with --yes flag:');
  console.log('  npx ts-node examples/avalon-upgrade.ts --yes\n');
  console.log('Or set environment variables:');
  console.log('  MINER_IP=192.168.1.100 FIRMWARE_FILE=./firmware.aup npx ts-node examples/avalon-upgrade.ts --yes\n');
}
