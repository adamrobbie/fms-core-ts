/**
 * Copyright 2020-2021 Canaan
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Integration tests for real miners on local network
 * 
 * Configure your miners in the MINERS array below.
 * These tests will connect to actual miners and test the API.
 * 
 * Usage:
 *   npm test -- tests/integration/miners.test.ts
 *   npm test -- --testNamePattern="Avalon-01"  # Test specific miner
 */

import { CGMinerAPI, CGMinerAPIResult, CGMinerStatus } from '../../src/cg-miner-api';

// Load environment variables if .env file exists
// eslint-disable-next-line @typescript-eslint/no-var-requires
try {
  require('dotenv').config({ quiet: true });
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
    model: process.env.MINER_1_MODEL || 'Avalon Miner',
  },
  {
    name: process.env.MINER_2_NAME || 'Avalon-02',
    ip: process.env.MINER_2_IP || '192.168.1.101', // Replace with your miner IP
    port: parseInt(process.env.MINER_2_PORT || '4028', 10),
    model: process.env.MINER_2_MODEL || 'Avalon Miner',
  },
  // Add more miners as needed
].filter(miner => {
  // Only include miners that have been configured (either via env vars or manually edited)
  const isPlaceholder = miner.ip === '192.168.1.100' || miner.ip === '192.168.1.101';
  return !isPlaceholder || process.env.MINER_1_IP || process.env.MINER_2_IP;
});

// Skip tests if no miners configured or INTEGRATION_TESTS env var is not set
const shouldRunIntegrationTests = MINERS.length > 0 && process.env.INTEGRATION_TESTS === 'true';

describe('Miner Integration Tests', () => {
  // Increase timeout for network requests
  jest.setTimeout(30000);

  MINERS.forEach((miner) => {
    describe(`${miner.name} (${miner.ip}:${miner.port})`, () => {
      beforeAll(() => {
        if (!shouldRunIntegrationTests) {
          console.log('⚠️  Integration tests skipped. Set INTEGRATION_TESTS=true to run.');
        }
      });

      test('should connect and get version', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.aioVersion(miner.ip, miner.port);
        
        expect(result.result).toBe(true);
        expect(result.isRequestSuccess()).toBe(true);
        
        const version = result.mm3SoftwareVersion();
        console.log(`  Version: ${version || 'N/A'}`);
        expect(version).toBeDefined();
      });

      test('should get miner information', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.aioVersion(miner.ip, miner.port);
        
        if (result.isRequestSuccess()) {
          const mac = result.mm3Mac();
          const dna = result.mm3Dna();
          const product = result.mm3ProductName();
          const model = result.mm3Model();
          const hwtype = result.mm3HardwareType();
          const swtype = result.mm3SoftwareType();
          
          console.log(`  MAC: ${mac || 'N/A'}`);
          console.log(`  DNA: ${dna || 'N/A'}`);
          console.log(`  Product: ${product || 'N/A'}`);
          console.log(`  Model: ${model || 'N/A'}`);
          console.log(`  HW Type: ${hwtype || 'N/A'}`);
          console.log(`  SW Type: ${swtype || 'N/A'}`);
          
          expect(result.status()).toBe(CGMinerStatus.Success);
        }
      });

      test('should get summary', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.summary(miner.ip, miner.port);
        
        expect(result.result).toBe(true);
        expect(result.isRequestSuccess()).toBe(true);
        
        const summary = result.summary();
        if (summary && Array.isArray(summary) && summary.length > 0) {
          const summaryData = summary[0];
          const s = summaryData as Record<string, unknown>;
          console.log(`  Elapsed: ${s.Elapsed || 'N/A'} seconds`);
          console.log(`  Hash Rate: ${s['GHS 5s'] || s['GHS av'] || 'N/A'} GH/s`);
          console.log(`  Accepted: ${s.Accepted || 'N/A'}`);
          console.log(`  Rejected: ${s.Rejected || 'N/A'}`);
        }
      });

      test('should get pools', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.pools(miner.ip, miner.port);
        
        expect(result.result).toBe(true);
        expect(result.isRequestSuccess()).toBe(true);
        
        const pools = result.pools();
        if (pools && Array.isArray(pools)) {
          console.log(`  Pool count: ${pools.length}`);
          pools.forEach((pool: any, index: number) => {
            console.log(`  Pool ${index + 1}: ${pool.URL || 'N/A'}`);
            console.log(`    Status: ${pool.Status || 'N/A'}`);
            console.log(`    Priority: ${pool.Priority || 'N/A'}`);
          });
        }
      });

      test('should get device information', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.edevs(miner.ip, miner.port);
        
        expect(result.result).toBe(true);
        expect(result.isRequestSuccess()).toBe(true);
        
        const devs = result.devs();
        if (devs && Array.isArray(devs)) {
          console.log(`  Device count: ${devs.length}`);
          devs.forEach((dev: any, index: number) => {
            console.log(`  Device ${index + 1}:`);
            console.log(`    ID: ${dev.ID || 'N/A'}`);
            console.log(`    Hash Rate: ${dev['MHS 5s'] || dev['MHS av'] || 'N/A'} MH/s`);
            console.log(`    Temperature: ${dev.Temperature || 'N/A'}°C`);
          });
        }
      });

      test('should get extended statistics', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        const result = await CGMinerAPI.estats(miner.ip, miner.port);
        
        expect(result.result).toBe(true);
        // estats might not be available on all firmware versions
        if (result.isRequestSuccess()) {
          const estats = result.stats();
          if (estats && Array.isArray(estats)) {
            console.log(`  Extended stats available: ${estats.length} entries`);
          }
        } else {
          console.log('  Extended stats not available (may require newer firmware)');
        }
      });

      test('should handle connection timeout gracefully', async () => {
        if (!shouldRunIntegrationTests) {
          return;
        }

        // Test with invalid IP to verify timeout handling
        const invalidResult = await CGMinerAPI.aioVersion('192.168.1.999', miner.port, 1, 0);
        
        // Should fail but not throw
        expect(invalidResult.result).toBe(false);
        expect(invalidResult.isRequestSuccess()).toBe(false);
      });
    });
  });

  // Test multiple miners in parallel
  test('should query all miners in parallel', async () => {
    if (!shouldRunIntegrationTests) {
      return;
    }

    const results = await Promise.all(
      MINERS.map((miner) => CGMinerAPI.aioVersion(miner.ip, miner.port))
    );

    results.forEach((result, index) => {
      console.log(`${MINERS[index].name}: ${result.isRequestSuccess() ? '✅' : '❌'}`);
      if (result.isRequestSuccess()) {
        console.log(`  Version: ${result.mm3SoftwareVersion() || 'N/A'}`);
      } else {
        console.log(`  Error: ${result.msg}`);
      }
    });

    // At least one should succeed if miners are configured
    const successCount = results.filter((r) => r.isRequestSuccess()).length;
    expect(successCount).toBeGreaterThan(0);
  });
});
