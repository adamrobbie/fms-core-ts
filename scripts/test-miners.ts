#!/usr/bin/env node

/**
 * Quick test script to check miner connectivity
 * 
 * Usage: 
 *   npm run test:miners:dev  (uses ts-node, imports from src)
 *   npm run test:miners      (builds and runs compiled version)
 */

// Import from source - works with ts-node
import { CGMinerAPI } from '../src/cg-miner-api';

// Load environment variables if .env file exists
// eslint-disable-next-line @typescript-eslint/no-var-requires
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional - continue without it
}

// CONFIGURE YOUR MINERS HERE
// Option 1: Use environment variables (recommended)
// Create a .env file from .env.example and set MINER_*_IP values
// Option 2: Replace the placeholder IPs below with your actual miner IPs
const MINERS = [
  {
    name: process.env.MINER_1_NAME || 'Avalon-01',
    ip: process.env.MINER_1_IP || '192.168.1.100', // Replace with your miner IP
    port: parseInt(process.env.MINER_1_PORT || '4028', 10),
  },
  {
    name: process.env.MINER_2_NAME || 'Avalon-02',
    ip: process.env.MINER_2_IP || '192.168.1.101', // Replace with your miner IP
    port: parseInt(process.env.MINER_2_PORT || '4028', 10),
  },
  // Add more miners as needed
].filter(miner => {
  // Only include miners that have been configured (either via env vars or manually edited)
  const isPlaceholder = miner.ip === '192.168.1.100' || miner.ip === '192.168.1.101';
  return !isPlaceholder || process.env.MINER_1_IP || process.env.MINER_2_IP;
});

async function testMiner(miner: { name: string; ip: string; port: number }) {
  console.log(`\n🔍 Testing ${miner.name} (${miner.ip}:${miner.port})...`);
  
  try {
    // Test version
    const versionResult = await CGMinerAPI.aioVersion(miner.ip, miner.port);
    
    if (versionResult.isRequestSuccess()) {
      console.log(`  ✅ Connected successfully!`);
      console.log(`  📦 Version: ${versionResult.mm3SoftwareVersion() || 'N/A'}`);
      console.log(`  🔧 MAC: ${versionResult.mm3Mac() || 'N/A'}`);
      console.log(`  🧬 DNA: ${versionResult.mm3Dna() || 'N/A'}`);
      console.log(`  🏭 Model: ${versionResult.mm3Model() || 'N/A'}`);
      console.log(`  💾 HW Type: ${versionResult.mm3HardwareType() || 'N/A'}`);
      
      // Get summary
      const summaryResult = await CGMinerAPI.summary(miner.ip, miner.port);
      if (summaryResult.isRequestSuccess()) {
        const summary = summaryResult.summary();
        if (summary && Array.isArray(summary) && summary.length > 0) {
          const s = summary[0] as Record<string, unknown>;
          const hashRate = (s['GHS 5s'] || s['GHS av'] || 'N/A') as string | number;
          console.log(`  ⚡ Hash Rate: ${hashRate} GH/s`);
          console.log(`  ✅ Accepted: ${s.Accepted || 0}`);
          console.log(`  ❌ Rejected: ${s.Rejected || 0}`);
        }
      }
      
      // Get pools
      const poolsResult = await CGMinerAPI.pools(miner.ip, miner.port);
      if (poolsResult.isRequestSuccess()) {
        const pools = poolsResult.pools();
        if (pools && Array.isArray(pools)) {
          console.log(`  🏊 Pools: ${pools.length}`);
          pools.forEach((pool: unknown, i: number) => {
            const p = pool as Record<string, unknown>;
            console.log(`     ${i + 1}. ${p.URL || 'N/A'} (Priority: ${p.Priority || 'N/A'})`);
          });
        }
      }
      
      return true;
    } else {
      console.log(`  ❌ Connection failed: ${versionResult.msg}`);
      return false;
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`  ❌ Error: ${err.message || String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing miners...\n');
  console.log(`Found ${MINERS.length} miner(s) configured\n`);
  
  const results = await Promise.all(
    MINERS.map((miner) => testMiner(miner))
  );
  
  const successCount = results.filter((r) => r).length;
  console.log(`\n📊 Results: ${successCount}/${MINERS.length} miners responding`);
  
  if (successCount === 0) {
    console.log('\n⚠️  No miners responded. Check:');
    console.log('  1. Miner IPs are correct');
    console.log('  2. Miners are powered on');
    console.log('  3. Network connectivity');
    console.log('  4. Firewall settings');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
