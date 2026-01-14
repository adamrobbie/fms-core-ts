# fms-core

The core functions that Canaan FMS and other miner management systems needed to communicate with and control Avalon miners.

This is a modern TypeScript port of the original Python library. These code can be used as reference about how to communicate with Avalon miners. This package can be used directly in your TypeScript/JavaScript projects.

## Installation

```bash
npm install fms-core
```

## Usage

### As a Library

```typescript
import { CGMinerAPI } from 'fms-core';

// Get miner version
const result = await CGMinerAPI.aioVersion('192.168.1.123');
if (result.isRequestSuccess()) {
  console.log('Version:', result.mm3SoftwareVersion());
}

// Get summary
const summary = await CGMinerAPI.summary('192.168.1.123');
console.log('Summary:', summary.summary());

// Upgrade firmware
import { upgradeFirmware } from 'fms-core';
const [success, result] = await upgradeFirmware(
  '192.168.1.123',
  4028,
  '/path/to/firmware.aup',
  720 // timeout in seconds
);
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

Main API class for communicating with Avalon miners.

#### Methods

- `aioVersion(ip, port?, firstTimeout?, retry?)` - Get miner version
- `summary(ip, port?, firstTimeout?, retry?)` - Get miner summary
- `pools(ip, port?, firstTimeout?, retry?)` - Get pool information
- `edevs(ip, port?, firstTimeout?, retry?)` - Get device information
- `estats(ip, port?, firstTimeout?, retry?)` - Get extended statistics
- `rebootMm3(ip, lastWhen?, port?, firstTimeout?, retry?)` - Reboot miner
- `toggleLED(ip, devId, modId, port?, firstTimeout?, retry?)` - Toggle LED
- `turnLED(ip, devId, modId, turnOn, port?, firstTimeout?, retry?)` - Turn LED on/off

### upgradeFirmware

Upgrade miner firmware.

```typescript
async function upgradeFirmware(
  ip: string,
  port: number,
  firmwareFilePath: string,
  timeout?: number
): Promise<[boolean, UpgradeResults]>
```

## Testing Against Real Miners

Quick start:
1. Edit `scripts/test-miners.ts` with your miner IPs
2. Run: `npm run test:miners`

For integration tests:
1. Edit `tests/integration/miners.test.ts` with your miner IPs
2. Run: `INTEGRATION_TESTS=true npm run test:integration`

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
- More information: https://github.com/Canaan-Creative/fms-core
- Python reference implementation: See `python-reference/` directory
