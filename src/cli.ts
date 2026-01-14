#!/usr/bin/env node

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
 * Query or control CGMiner-compatible Bitcoin miners
 * 
 * Works with any CGMiner-compatible miner (Avalon, Antminer, etc.)
 * Includes Avalon-specific features like firmware upgrade.
 * 
 * Usage:
 * ------
 *     $ fmsc -h
 * More information is available at:
 * - https://github.com/adamrobbie/fms-core-ts
 * Version:
 * --------
 * - fmsc v0.0.3
 */

import { upgradeFirmware } from './upgrade';
import { UpgradeResults } from './aio-upgrade';
import { VERSION } from './index';
import { logger, LogLevel } from './logger';

interface ParsedArgs {
  command?: string;
  ip?: string;
  port?: string;
  file?: string;
  timeout?: string;
  logLevel?: string;
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
    } else if (arg === '-v' || arg === '--version') {
      parsed.version = true;
    } else if (arg === '--log-level' || arg === '-l' || arg === '--log') {
      parsed.logLevel = args[++i];
    } else if (arg === '--ip' || arg === '-I') {
      parsed.ip = args[++i];
    } else if (arg === '--port' || arg === '-P') {
      parsed.port = args[++i];
    } else if (arg === '--file' || arg === '-F') {
      parsed.file = args[++i];
    } else if (arg === '--timeout' || arg === '-T') {
      parsed.timeout = args[++i];
    } else if (!arg.startsWith('-') && !parsed.command) {
      parsed.command = arg;
    }
    i++;
  }

  return parsed;
}

function showHelp(): void {
  console.log(`
Query or control CGMiner-compatible Bitcoin miners

Works with any CGMiner-compatible miner (Avalon, Antminer, etc.)
Includes Avalon-specific features like firmware upgrade.

Usage:
  fmsc <command> [options]

Commands:
  upgrade              Upgrade firmware for Avalon miners (AUP format)

Options:
  -h, --help          Show help
  -v, --version       Show version
  -l, --log-level     Logging level (debug, info, warn, error) [default: info]

Upgrade Options (Avalon-specific):
  --ip, -I <ip>       Miner IP address (required)
  --port, -P <port>   Miner API port [default: 4028]
  --file, -F <file>   Firmware file path (.aup format, required)
  --timeout, -T <sec> Upgrade timeout in seconds [default: 720]

Examples:
  # Upgrade Avalon miner firmware
  fmsc upgrade --ip 192.168.1.123 --file firmware.aup
  fmsc upgrade --ip 192.168.1.123 --file firmware.aup --port 4028 --timeout 720

More information: https://github.com/adamrobbie/fms-core-ts
`);
}

function showVersion(): void {
  console.log(`fmsc v${VERSION}`);
}

export function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }

  const parsed = parseArgs(args);

  // Set log level
  if (parsed.logLevel) {
    const level = LogLevel[parsed.logLevel.toUpperCase() as keyof typeof LogLevel];
    if (level !== undefined) {
      logger.setLevel(level);
    }
  }

  // Handle global options
  if (parsed.help) {
    showHelp();
    return;
  }

  if (parsed.version) {
    showVersion();
    return;
  }

  // Handle commands
  if (parsed.command === 'upgrade') {
    if (!parsed.ip) {
      console.error('Error: --ip is required');
      console.error('Run "fmsc upgrade --help" for usage information');
      process.exit(1);
    }

    if (!parsed.file) {
      console.error('Error: --file is required');
      console.error('Run "fmsc upgrade --help" for usage information');
      process.exit(1);
    }

    const ip = parsed.ip;
    const port = parseInt(parsed.port || '4028', 10);
    const file = parsed.file;
    const timeout = parseInt(parsed.timeout || '720', 10);

    (async () => {
      let success = false;
      let upgradeResult: UpgradeResults = UpgradeResults.unexpectedError;

      try {
        [success, upgradeResult] = await upgradeFirmware(ip, port, file, timeout);
      } finally {
        logger.info(
          `upgrade ${ip}:${port} firmware to ${file} finish: ${
            success ? 'success' : 'failed'
          } with ${upgradeResult}`
        );
        process.exit(success ? 0 : 1);
      }
    })().catch((error: unknown) => {
      const err = error as Error;
      logger.error(`upgrade failed: ${err.message || String(error)}`);
      process.exit(1);
    });
  } else {
    console.error(`Unknown command: ${parsed.command || 'none'}`);
    console.error('Run "fmsc --help" for usage information');
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e: any) {
    logger.error(`fmsc main uncaught exception: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
