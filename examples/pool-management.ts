/**
 * Pool Management Example
 * 
 * Demonstrates how to manage mining pools:
 * - List current pools
 * - Add a new pool
 * - Switch active pool
 * - Enable/disable pools
 * - Remove a pool
 * 
 * Usage:
 *   MINER_IP=192.168.1.100 npx ts-node examples/pool-management.ts
 * 
 * ⚠️  WARNING: This example modifies pool settings!
 *     Comment out operations you don't want to run.
 */

import { CGMinerAPI } from '../src';

const MINER_IP = process.env.MINER_IP || '192.168.1.100';
const MINER_PORT = parseInt(process.env.MINER_PORT || '4028', 10);

// Example pool configuration - replace with your actual pool info
const EXAMPLE_POOL = {
  url: 'stratum+tcp://pool.example.com:3333',
  user: 'your_wallet.worker1',
  password: 'x',
};

async function listPools(): Promise<void> {
  console.log('\n📋 Current Pools:');
  console.log('─'.repeat(50));

  const result = await CGMinerAPI.pools(MINER_IP, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    const pools = result.poolsTyped();
    if (pools && pools.length > 0) {
      pools.forEach((pool, i) => {
        const active = pool.Status === 'Alive' ? '🟢' : '🔴';
        const current = pool.Stratum_Active ? ' ← ACTIVE' : '';
        console.log(`  ${active} [${i}] ${pool.URL || 'N/A'}${current}`);
        console.log(`      User: ${pool.User || 'N/A'}`);
        console.log(`      Priority: ${pool.Priority ?? 'N/A'}, Status: ${pool.Status || 'N/A'}`);
      });
    } else {
      console.log('  No pools configured');
    }
  } else {
    console.log(`  Error: ${result.msg}`);
  }
}

async function addPool(url: string, user: string, password: string): Promise<boolean> {
  console.log(`\n➕ Adding pool: ${url}`);
  
  const result = await CGMinerAPI.addPool(MINER_IP, url, user, password, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    console.log('  ✅ Pool added successfully');
    return true;
  } else {
    console.log(`  ❌ Failed: ${result.statusMsg() || result.msg}`);
    return false;
  }
}

async function switchPool(poolIndex: number): Promise<boolean> {
  console.log(`\n🔄 Switching to pool ${poolIndex}...`);
  
  const result = await CGMinerAPI.switchPool(MINER_IP, poolIndex, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    console.log(`  ✅ Switched to pool ${poolIndex}`);
    return true;
  } else {
    console.log(`  ❌ Failed: ${result.statusMsg() || result.msg}`);
    return false;
  }
}

async function enablePool(poolIndex: number): Promise<boolean> {
  console.log(`\n✅ Enabling pool ${poolIndex}...`);
  
  const result = await CGMinerAPI.enablePool(MINER_IP, poolIndex, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    console.log(`  ✅ Pool ${poolIndex} enabled`);
    return true;
  } else {
    console.log(`  ❌ Failed: ${result.statusMsg() || result.msg}`);
    return false;
  }
}

async function disablePool(poolIndex: number): Promise<boolean> {
  console.log(`\n🚫 Disabling pool ${poolIndex}...`);
  
  const result = await CGMinerAPI.disablePool(MINER_IP, poolIndex, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    console.log(`  ✅ Pool ${poolIndex} disabled`);
    return true;
  } else {
    console.log(`  ❌ Failed: ${result.statusMsg() || result.msg}`);
    return false;
  }
}

async function removePool(poolIndex: number): Promise<boolean> {
  console.log(`\n🗑️  Removing pool ${poolIndex}...`);
  
  const result = await CGMinerAPI.removePool(MINER_IP, poolIndex, MINER_PORT);
  
  if (result.isRequestSuccess()) {
    console.log(`  ✅ Pool ${poolIndex} removed`);
    return true;
  } else {
    console.log(`  ❌ Failed: ${result.statusMsg() || result.msg}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Pool Management Example');
  console.log(`  Miner: ${MINER_IP}:${MINER_PORT}`);
  console.log('═══════════════════════════════════════');

  try {
    // List current pools
    await listPools();

    // ⚠️ UNCOMMENT THE OPERATIONS YOU WANT TO RUN:

    // // Add a new pool
    // await addPool(EXAMPLE_POOL.url, EXAMPLE_POOL.user, EXAMPLE_POOL.password);
    // await listPools();

    // // Switch to pool 0
    // await switchPool(0);

    // // Disable pool 1
    // await disablePool(1);

    // // Enable pool 1
    // await enablePool(1);

    // // Remove pool 2 (be careful!)
    // await removePool(2);
    // await listPools();

    console.log('\n✅ Done\n');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
