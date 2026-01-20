# fms-core Examples

Example scripts demonstrating how to use the fms-core library.

## Setup

1. Configure your miner IP address in the example scripts or use environment variables:

   ```bash
   export MINER_IP="192.168.1.100"
   export MINER_PORT="4028"  # optional, defaults to 4028
   ```

## Running Examples

Run examples with ts-node (examples import from `../src`):

```bash
npx ts-node examples/basic-connection.ts
```

If you want to run against the built output (`dist/`), change the imports in the
examples from `../src` to `../dist` and then run `npm run build`.

## Available Examples

| File | Description |
| ---- | ----------- |
| `basic-connection.ts` | Test basic miner connectivity |
| `get-miner-info.ts` | Retrieve detailed miner information (version, stats, devices) |
| `pool-management.ts` | Add, remove, switch, enable/disable pools |
| `monitor-hashrate.ts` | Simple hashrate monitoring with interval polling |
| `batch-query.ts` | Query multiple miners in parallel |
| `avalon-upgrade.ts` | Avalon-specific firmware upgrade example |

## Environment Variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `MINER_IP` | `192.168.1.100` | Miner IP address |
| `MINER_PORT` | `4028` | CGMiner API port |
| `MINER_IPS` | - | Comma-separated list of IPs for batch queries |

## Notes

- These examples default to importing from `../src` for local development
- To test the published package, change imports to `fms-core` / `fms-core/avalon`
- Pool credentials in examples are placeholders - replace with your actual pool info
