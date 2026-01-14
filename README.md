# fms-core

**Modern TypeScript CGMiner API Library - Zero Dependencies**

A comprehensive, production-ready TypeScript library for communicating with **any CGMiner-compatible Bitcoin miner**. Works with Avalon, Antminer, and other CGMiner-based miners. Includes Avalon-specific extensions for firmware upgrade and MM3 features.

**Key Features:**
- ✅ **Works with any CGMiner-compatible miner** (Avalon, Antminer, etc.)
- ✅ **Zero runtime dependencies** - lightweight and fast
- ✅ **Full TypeScript support** with comprehensive type definitions
- ✅ **Modern async/await** API
- ✅ **Avalon extensions** - firmware upgrade, MM3-specific features
- ✅ **Production ready** - comprehensive error handling, logging, testing

This is a modern TypeScript port of the original Python library, generalized to support all CGMiner-compatible miners while maintaining Avalon-specific functionality.

## Installation

```bash
npm install fms-core
```

## Usage

### General CGMiner API (Any Miner)

```typescript
import { CGMinerAPI } from 'fms-core';

// Works with any CGMiner-compatible miner (Avalon, Antminer, etc.)
const ip = '192.168.1.123';
const port = 4028;

// Get miner version
const version = await CGMinerAPI.aioVersion(ip, port);
if (version.isRequestSuccess()) {
  const versionData = version.version();
  console.log('Version:', versionData);
}

// Get miner summary (hash rate, accepted/rejected shares, etc.)
const summary = await CGMinerAPI.summary(ip, port);
if (summary.isRequestSuccess()) {
  const summaryData = summary.summary();
  console.log('Hash Rate:', summaryData?.[0]?.['GHS 5s']);
  console.log('Accepted:', summaryData?.[0]?.Accepted);
  console.log('Rejected:', summaryData?.[0]?.Rejected);
}

// Get pool information
const pools = await CGMinerAPI.pools(ip, port);
console.log('Pools:', pools.pools());

// Get device information
const devices = await CGMinerAPI.edevs(ip, port);
console.log('Devices:', devices.edevs());

// Get extended statistics
const stats = await CGMinerAPI.estats(ip, port);
console.log('Stats:', stats.estats());

// Pool management (add, remove, switch, enable, disable)
await CGMinerAPI.addPool(ip, port, 'stratum+tcp://pool.example.com:3333', 'user', 'pass');
await CGMinerAPI.switchPool(ip, port, 0); // Switch to pool 0
await CGMinerAPI.enablePool(ip, port, 0);
await CGMinerAPI.disablePool(ip, port, 1);
```

### Avalon-Specific Features

```typescript
// Import Avalon extensions
import { upgradeFirmware } from 'fms-core/avalon';
// or
import { upgradeFirmware } from 'fms-core';

// Get Avalon-specific version info (MM3 helpers)
const version = await CGMinerAPI.aioVersion('192.168.1.123');
if (version.isRequestSuccess()) {
  console.log('Software Version:', version.mm3SoftwareVersion());
  console.log('MAC Address:', version.mm3Mac());
  console.log('DNA:', version.mm3Dna());
  console.log('Model:', version.mm3Model());
  console.log('Hardware Type:', version.mm3HardwareType());
}

// Upgrade Avalon miner firmware (AUP format)
const [success, result] = await upgradeFirmware(
  '192.168.1.123',
  4028,
  '/path/to/firmware.aup',
  720 // timeout in seconds
);

// Avalon-specific commands
await CGMinerAPI.rebootMm3('192.168.1.123', 4028);
await CGMinerAPI.mm3SetWorkmode('192.168.1.123', 4028, 0, 0, 0);
```

### CLI Tool

After installation, a script command `fmsc` will be available. Get help by:

```bash
npx fmsc -h
```

Upgrade firmware:

```bash
npx fmsc upgrade --ip 192.168.1.123 --file firmware.aup --port 4028 --timeout 720
```

## API Reference

### CGMinerAPI

Main API class for communicating with **any CGMiner-compatible miner**.

#### General CGMiner Commands (All Miners)

- `aioVersion(ip, port?, firstTimeout?, retry?)` - Get miner version information
- `summary(ip, port?, firstTimeout?, retry?)` - Get miner summary (hash rate, shares, etc.)
- `pools(ip, port?, firstTimeout?, retry?)` - Get pool configuration
- `edevs(ip, port?, firstTimeout?, retry?)` - Get device information
- `estats(ip, port?, firstTimeout?, retry?)` - Get extended statistics
- `addPool(ip, port, url, user, pass, ...)` - Add a mining pool
- `removePool(ip, port, poolId)` - Remove a pool
- `switchPool(ip, port, poolId)` - Switch to a different pool
- `enablePool(ip, port, poolId)` - Enable a pool
- `disablePool(ip, port, poolId)` - Disable a pool
- `config(ip, port, ...)` - Configure miner settings
- `toggleLED(ip, devId, modId, port?, firstTimeout?, retry?)` - Toggle LED (if supported)
- `turnLED(ip, devId, modId, turnOn, port?, firstTimeout?, retry?)` - Turn LED on/off (if supported)

#### Avalon-Specific Commands

- `rebootMm3(ip, lastWhen?, port?, firstTimeout?, retry?)` - Reboot Avalon miner
- `mm3SetWorkmode(ip, port, devId, modId, workmode, ...)` - Set Avalon work mode
- `mm3Upgrade(ip, port, ...)` - Avalon firmware upgrade command
- `mm3SoftwareVersion()` - Get Avalon software version (helper method on CGMinerAPIResult)
- `mm3Mac()` - Get Avalon MAC address (helper method)
- `mm3Dna()` - Get Avalon DNA (helper method)
- `mm3Model()` - Get Avalon model (helper method)
- `mm3HardwareType()` - Get Avalon hardware type (helper method)

### Avalon Extensions (`fms-core/avalon`)

#### upgradeFirmware

Upgrade Avalon miner firmware (AUP format).

```typescript
async function upgradeFirmware(
  ip: string,
  port: number,
  firmwareFilePath: string,
  timeout?: number
): Promise<[boolean, UpgradeResults]>
```

#### AUPFile

Parse and validate Avalon firmware files (AUP format).

```typescript
import { AUPFile } from 'fms-core/avalon';
const aupFile = new AUPFile('/path/to/firmware.aup');
```

## Testing Against Real Miners

### Quick Start

**Option 1: Using Environment Variables (Recommended)**
1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Edit `.env` and add your miner IPs
3. Run: `npm run test:miners`

**Option 2: Direct Configuration**
1. Edit `scripts/test-miners.ts` and replace placeholder IPs (`192.168.1.100`, `192.168.1.101`) with your actual miner IPs
2. Run: `npm run test:miners`

### Integration Tests
1. Configure miners using `.env` file or edit `tests/integration/miners.test.ts`
2. Run: `INTEGRATION_TESTS=true npm run test:integration`

**Note:** The `.env` file is gitignored and will not be committed to the repository.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run unit tests
npm test

# Run integration tests (requires INTEGRATION_TESTS=true)
npm run test:integration

# Test against real miners
npm run test:miners
```

## License

Apache License 2.0

## Links

- Original Python version: https://github.com/Canaan-Creative/fms-core
- This TypeScript port: https://github.com/adamrobbie/fms-core-ts
- Python reference implementation: See `python-reference/` directory
