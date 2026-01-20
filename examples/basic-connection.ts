/**
 * Basic Connection Example
 * 
 * Tests connectivity to a CGMiner-compatible miner and displays basic info.
 * 
 * Usage:
 *   MINER_IP=192.168.1.100 npx ts-node examples/basic-connection.ts
 */

import { CGMinerAPI } from '../src';

const MINER_IP = process.env.MINER_IP || '192.168.1.100';
const MINER_PORT = parseInt(process.env.MINER_PORT || '4028', 10);

async function main() {
  console.log(`Connecting to miner at ${MINER_IP}:${MINER_PORT}...\n`);

  try {
    // Test connection with version command
    const result = await CGMinerAPI.aioVersion(MINER_IP, MINER_PORT, 5, 1);

    if (result.isRequestSuccess()) {
      console.log('✅ Connection successful!\n');
      
      const version = result.version();
      if (version && version.length > 0) {
        console.log('Miner Information:');
        console.log('------------------');
        console.log(`  Software Version: ${result.mm3SoftwareVersion() || 'N/A'}`);
        console.log(`  MAC Address:      ${result.mm3Mac() || 'N/A'}`);
        console.log(`  DNA:              ${result.mm3Dna() || 'N/A'}`);
        console.log(`  Model:            ${result.mm3Model() || 'N/A'}`);
        console.log(`  Hardware Type:    ${result.mm3HardwareType() || 'N/A'}`);
        console.log(`  Product:          ${result.mm3ProductName() || 'N/A'}`);
      }
    } else {
      console.log('❌ Connection failed');
      console.log(`   Error: ${result.msg || result.statusMsg() || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
