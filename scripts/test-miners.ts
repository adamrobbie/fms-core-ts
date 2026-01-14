#!/usr/bin/env node

/**
 * Quick test script to check miner connectivity
 * 
 * Usage: npx ts-node scripts/test-miners.ts
 * Or: npm run build && node dist/scripts/test-miners.js
 */

import { CGMinerAPI } from '../dist/cg-miner-api';

// CONFIGURE YOUR MINERS HERE
const MINERS = [
  {
    name: 'Avalon-01',
    ip: '192.168.1.122',
    port: 4028,
  },
  {
    name: 'Avalon-02',
    ip: '192.168.1.130',
    port: 4028,
  },
  // Add more miners as needed
];

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
          const s = summary[0];
          console.log(`  ⚡ Hash Rate: ${s['GHS 5s'] || s['GHS av'] || 'N/A'} GH/s`);
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
          pools.forEach((pool: any, i: number) => {
            console.log(`     ${i + 1}. ${pool.URL || 'N/A'} (Priority: ${pool.Priority || 'N/A'})`);
          });
        }
      }
      
      return true;
    } else {
      console.log(`  ❌ Connection failed: ${versionResult.msg}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
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
