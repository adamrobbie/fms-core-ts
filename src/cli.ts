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
 * Query or control Avalon miners
 * Usage:
 * ------
 *     $ fmsc -h
 * More information is available at:
 * - https://github.com/Canaan-Creative/fms-core
 * Version:
 * --------
 * - fmsc v0.0.3
 */

import { Command } from 'commander';
import { upgradeFirmware } from './upgrade';
import { UpgradeResults } from './aio-upgrade';
import { VERSION } from './index';
import { logger, LogLevel } from './logger';

const program = new Command();

program
  .name('fmsc')
  .description('Query or control Avalon miners')
  .version(VERSION);

program
  .option('--log <level>', 'logging level', 'info')
  .option('-l, --log-level <level>', 'logging level (debug, info, warn, error)', 'info')
  .hook('preAction', (thisCommand) => {
    const logLevel = thisCommand.opts().logLevel || thisCommand.opts().log || 'info';
    const level = LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel];
    if (level !== undefined) {
      logger.setLevel(level);
    }
  });

program
  .command('upgrade')
  .description('upgrade firmware for one Avalon miner')
  .requiredOption('--ip <ip>', 'Avalon miner IP address, such as 192.168.1.123')
  .option('-I, --ip <ip>', 'Avalon miner IP address')
  .option('-P, --port <port>', 'Avalon miner API port', '4028')
  .requiredOption('--file <file>', 'Avalon miner firmware file path')
  .option('-F, --file <file>', 'Avalon miner firmware file path')
  .option('-T, --timeout <timeout>', 'Upgrade timeout in seconds', '720')
  .action(async (options) => {
    const ip = options.ip;
    const port = parseInt(options.port || '4028', 10);
    const file = options.file;
    const timeout = parseInt(options.timeout || '720', 10);

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
    }
  });

export function main(): void {
  program.parse(process.argv);

  if (process.argv.length <= 2) {
    program.help();
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
