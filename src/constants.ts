/**
 * Copyright 2020-2025 Canaan
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
 * Network and protocol constants
 */

/** Default CGMiner API port */
export const DEFAULT_PORT = 4028;

/** Initial connection timeout in seconds */
export const DEFAULT_FIRST_TIMEOUT = 5;

/** Default number of retry attempts */
export const DEFAULT_RETRY_COUNT = 0;

/** Maximum total timeout in seconds (30 minutes) */
export const DEFAULT_TOTAL_TIMEOUT = 30 * 60;

/** Socket buffer size in bytes (8 KiB) */
export const SOCKET_BUFFER_SIZE = 8192;

/** Delay between connection retries in milliseconds */
export const CONNECTION_RETRY_DELAY = 500;

/** Delay between retry attempts in milliseconds */
export const RETRY_SLEEP_DELAY = 100;

/**
 * Upgrade-related constants
 */

/** Upgrade packet header length in bytes */
export const UPGRADE_HEADER_LENGTH = 30;

/** Default UID for upgrade commands */
export const UPGRADE_UID_DEFAULT = 0;

/** Default offset for upgrade commands */
export const UPGRADE_OFFSET_DEFAULT = 888;

/** Maximum command ID for upgrades (0x8000) */
export const UPGRADE_CMD_ID_MAX = 0x8000;

/** Sub-command identifier for upgrades */
export const UPGRADE_SUB_CMD = 0x0;

/** Reserved bytes count (first block) */
export const UPGRADE_RESERVED_BYTES_1 = 3;

/** Reserved bytes count (second block) */
export const UPGRADE_RESERVED_BYTES_2 = 2;

/** Maximum length of version string in bytes */
export const UPGRADE_VERSION_MAX_LENGTH = 8;

/**
 * Timeout constants
 */

/** Reboot wait timeout in seconds */
export const REBOOT_TIMEOUT = 60;

/** Version check timeout in seconds (5 minutes) */
export const VERSION_CHECK_TIMEOUT = 5 * 60;

/** Default upgrade operation timeout in seconds (12 minutes) */
export const UPGRADE_TIMEOUT_DEFAULT = 12 * 60;

/**
 * Error codes for internal error handling
 */
export enum ErrorCode {
  /** Operation was cancelled by user or system */
  CANCELLED = 99999,
  /** Invalid input parameters provided */
  INVALID_INPUT = 99998,
}

/** @deprecated Use ErrorCode.CANCELLED instead */
export const ERR_CODE_CANCELLED = ErrorCode.CANCELLED;

/** @deprecated Use ErrorCode.INVALID_INPUT instead */
export const ERR_CODE_INVALID_INPUT = ErrorCode.INVALID_INPUT;
