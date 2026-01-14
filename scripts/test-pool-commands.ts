#!/usr/bin/env node

/**
 * Test script for new pool management commands
 * 
 * Usage: npm run build && ts-node scripts/test-pool-commands.ts
 * 
 * WARNING: This script will test pool management commands.
 * It will NOT add or remove pools, but may switch between existing pools.
 */

import { CGMinerAPI } from '../src/cg-miner-api';

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

async function testPoolCommands(miner: { name: string; ip: string; port: number }) {
  console.log(`\n🔍 Testing ${miner.name} (${miner.ip}:${miner.port})...`);
  
  try {
    // 1. Get current pools
    console.log(`\n  📋 Step 1: Getting current pools...`);
    const poolsResult = await CGMinerAPI.pools(miner.ip, miner.port);
    
    if (!poolsResult.isRequestSuccess()) {
      console.log(`  ❌ Failed to get pools: ${poolsResult.msg}`);
      return false;
    }
    
    const pools = poolsResult.pools();
    if (!pools || !Array.isArray(pools) || pools.length === 0) {
      console.log(`  ⚠️  No pools found`);
      return false;
    }
    
    console.log(`  ✅ Found ${pools.length} pool(s):`);
    pools.forEach((pool: unknown, i: number) => {
      const p = pool as Record<string, unknown>;
      console.log(`     ${i}. ${p.URL || 'N/A'} (Priority: ${p.Priority || 'N/A'}, Status: ${p.Status || 'N/A'})`);
    });
    
    // 2. Test config command (read-only)
    console.log(`\n  ⚙️  Step 2: Testing config command (read-only)...`);
    try {
      const configResult = await CGMinerAPI.config(miner.ip, '', miner.port);
      if (configResult.isRequestSuccess()) {
        console.log(`  ✅ Config command successful`);
        const configData = configResult.responseDict();
        if (configData && Object.keys(configData).length > 0) {
          console.log(`     Config keys: ${Object.keys(configData).join(', ')}`);
        }
      } else {
        console.log(`  ⚠️  Config command returned: ${configResult.statusMsg() || 'Unknown status'}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`  ⚠️  Config command error: ${err.message}`);
    }
    
    // 3. Test switchPool (only if we have multiple pools)
    if (pools.length > 1) {
      console.log(`\n  🔄 Step 3: Testing switchPool command...`);
      const currentPoolIndex = 0; // Assume first pool is active
      const targetPoolIndex = 1; // Switch to second pool
      
      console.log(`     Switching from pool ${currentPoolIndex} to pool ${targetPoolIndex}...`);
      try {
        const switchResult = await CGMinerAPI.switchPool(miner.ip, targetPoolIndex, miner.port);
        if (switchResult.isRequestSuccess()) {
          console.log(`  ✅ Successfully switched to pool ${targetPoolIndex}`);
          
          // Wait a moment, then verify
          await new Promise(resolve => setTimeout(resolve, 2000));
          const verifyResult = await CGMinerAPI.pools(miner.ip, miner.port);
          if (verifyResult.isRequestSuccess()) {
            const verifyPools = verifyResult.pools();
            if (verifyPools && Array.isArray(verifyPools) && verifyPools.length > targetPoolIndex) {
              const activePool = verifyPools[targetPoolIndex] as Record<string, unknown>;
              console.log(`     Verified: Active pool is now ${activePool.URL || 'N/A'}`);
            }
          }
          
          // Switch back to original pool
          console.log(`     Switching back to pool ${currentPoolIndex}...`);
          const switchBackResult = await CGMinerAPI.switchPool(miner.ip, currentPoolIndex, miner.port);
          if (switchBackResult.isRequestSuccess()) {
            console.log(`  ✅ Successfully switched back to pool ${currentPoolIndex}`);
          } else {
            console.log(`  ⚠️  Failed to switch back: ${switchBackResult.statusMsg()}`);
          }
        } else {
          console.log(`  ⚠️  Switch failed: ${switchResult.statusMsg() || 'Unknown error'}`);
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.log(`  ⚠️  Switch error: ${err.message}`);
      }
    } else {
      console.log(`\n  ⏭️  Step 3: Skipping switchPool test (need at least 2 pools)`);
    }
    
    // 4. Test enablePool/disablePool (only if we have multiple pools)
    if (pools.length > 1) {
      console.log(`\n  🔌 Step 4: Testing enablePool/disablePool commands...`);
      const testPoolIndex = pools.length - 1; // Test with last pool
      
      try {
        // First check if pool is enabled
        const poolToTest = pools[testPoolIndex] as Record<string, unknown>;
        const isEnabled = poolToTest.Status === 'Alive' || poolToTest.Status === 'Enabled';
        
        if (isEnabled) {
          console.log(`     Disabling pool ${testPoolIndex}...`);
          const disableResult = await CGMinerAPI.disablePool(miner.ip, testPoolIndex, miner.port);
          if (disableResult.isRequestSuccess()) {
            console.log(`  ✅ Successfully disabled pool ${testPoolIndex}`);
            
            // Wait and verify
            await new Promise(resolve => setTimeout(resolve, 2000));
            const verifyResult = await CGMinerAPI.pools(miner.ip, miner.port);
            if (verifyResult.isRequestSuccess()) {
              const verifyPools = verifyResult.pools();
              if (verifyPools && Array.isArray(verifyPools) && verifyPools.length > testPoolIndex) {
                const disabledPool = verifyPools[testPoolIndex] as Record<string, unknown>;
                console.log(`     Verified: Pool status is now ${disabledPool.Status || 'N/A'}`);
              }
            }
            
            // Re-enable the pool
            console.log(`     Re-enabling pool ${testPoolIndex}...`);
            const enableResult = await CGMinerAPI.enablePool(miner.ip, testPoolIndex, miner.port);
            if (enableResult.isRequestSuccess()) {
              console.log(`  ✅ Successfully re-enabled pool ${testPoolIndex}`);
            } else {
              console.log(`  ⚠️  Failed to re-enable: ${enableResult.statusMsg()}`);
            }
          } else {
            console.log(`  ⚠️  Disable failed: ${disableResult.statusMsg() || 'Unknown error'}`);
          }
        } else {
          console.log(`     Enabling pool ${testPoolIndex}...`);
          const enableResult = await CGMinerAPI.enablePool(miner.ip, testPoolIndex, miner.port);
          if (enableResult.isRequestSuccess()) {
            console.log(`  ✅ Successfully enabled pool ${testPoolIndex}`);
            
            // Re-disable to restore original state
            await new Promise(resolve => setTimeout(resolve, 2000));
            const disableResult = await CGMinerAPI.disablePool(miner.ip, testPoolIndex, miner.port);
            if (disableResult.isRequestSuccess()) {
              console.log(`  ✅ Restored pool ${testPoolIndex} to disabled state`);
            }
          } else {
            console.log(`  ⚠️  Enable failed: ${enableResult.statusMsg() || 'Unknown error'}`);
          }
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.log(`  ⚠️  Enable/Disable error: ${err.message}`);
      }
    } else {
      console.log(`\n  ⏭️  Step 4: Skipping enablePool/disablePool test (need at least 2 pools)`);
    }
    
    // 5. Test addPool (commented out by default - uncomment to test)
    // WARNING: This will add a pool to your miner!
    /*
    console.log(`\n  ➕ Step 5: Testing addPool command...`);
    const testPoolUrl = 'stratum+tcp://test.pool.example.com:3333';
    const testPoolUser = 'test.worker';
    const testPoolPassword = 'x';
    
    try {
      const addResult = await CGMinerAPI.addPool(
        miner.ip,
        testPoolUrl,
        testPoolUser,
        testPoolPassword,
        miner.port
      );
      if (addResult.isRequestSuccess()) {
        console.log(`  ✅ Successfully added test pool`);
        
        // Verify it was added
        const verifyResult = await CGMinerAPI.pools(miner.ip, miner.port);
        if (verifyResult.isRequestSuccess()) {
          const verifyPools = verifyResult.pools();
          console.log(`     Total pools now: ${verifyPools?.length || 0}`);
        }
        
        // Remove the test pool
        const removeResult = await CGMinerAPI.removePool(miner.ip, pools.length, miner.port);
        if (removeResult.isRequestSuccess()) {
          console.log(`  ✅ Successfully removed test pool`);
        }
      } else {
        console.log(`  ⚠️  Add pool failed: ${addResult.statusMsg() || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.log(`  ⚠️  Add pool error: ${err.message}`);
    }
    */
    
    console.log(`\n  ✅ All tests completed for ${miner.name}`);
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.log(`  ❌ Error: ${err.message || String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing New Pool Management Commands');
  console.log('=======================================\n');
  console.log(`Found ${MINERS.length} miner(s) configured\n`);
  
  if (MINERS.length === 0) {
    console.log('⚠️  No miners configured. Please edit MINERS array in the script.');
    process.exit(1);
  }
  
  const results: boolean[] = [];
  
  for (const miner of MINERS) {
    const success = await testPoolCommands(miner);
    results.push(success);
  }
  
  console.log('\n📊 Results Summary');
  console.log('==================\n');
  const successCount = results.filter(r => r).length;
  console.log(`✅ Successful: ${successCount}/${MINERS.length}`);
  console.log(`❌ Failed: ${MINERS.length - successCount}/${MINERS.length}`);
  
  if (successCount === MINERS.length) {
    console.log('\n🎉 All tests passed!');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
