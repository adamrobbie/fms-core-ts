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
 * fms-core - Modern TypeScript CGMiner API Library
 * 
 * A comprehensive, zero-dependency TypeScript library for communicating with
 * CGMiner-compatible Bitcoin miners. Includes Avalon-specific extensions.
 * 
 * See https://github.com/adamrobbie/fms-core-ts for more information
 * 
 * @example
 * ```typescript
 * // General CGMiner API (works with any CGMiner-compatible miner)
 * import { CGMinerAPI } from 'fms-core';
 * const result = await CGMinerAPI.summary('192.168.1.123');
 * 
 * // Avalon-specific features
 * import { upgradeFirmware } from 'fms-core/avalon';
 * const [success] = await upgradeFirmware('192.168.1.123', 4028, 'firmware.aup');
 * ```
 */

export const VERSION = "0.0.3";

// Core CGMiner API - works with any CGMiner-compatible miner
export * from './cg-miner-api';
export * from './utils';
export * from './logger';
export * from './constants';

// Avalon-specific features (also available via 'fms-core/avalon')
export * from './upgrade';
export * from './aio-upgrade';
export * from './aup-file';
export * from './aup-parser';
