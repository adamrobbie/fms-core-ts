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
 * Network and protocol constants
 */
export const DEFAULT_PORT = 4028;
export const DEFAULT_FIRST_TIMEOUT = 5; // seconds
export const DEFAULT_RETRY_COUNT = 0;
export const DEFAULT_TOTAL_TIMEOUT = 30 * 60; // 30 minutes in seconds
export const SOCKET_BUFFER_SIZE = 8 * 1024; // 8 KiB
export const CONNECTION_RETRY_DELAY = 500; // milliseconds
export const RETRY_SLEEP_DELAY = 100; // milliseconds

/**
 * Upgrade-related constants
 */
export const UPGRADE_HEADER_LENGTH = 30; // bytes
export const UPGRADE_UID_DEFAULT = 0;
export const UPGRADE_OFFSET_DEFAULT = 888; // Default offset for upgrade commands
export const UPGRADE_CMD_ID_MAX = 65536 / 2;
export const UPGRADE_SUB_CMD = 0x0;
export const UPGRADE_RESERVED_BYTES_1 = 3;
export const UPGRADE_RESERVED_BYTES_2 = 2;
export const UPGRADE_VERSION_MAX_LENGTH = 8;

/**
 * Timeout constants
 */
export const REBOOT_TIMEOUT = 60; // seconds
export const VERSION_CHECK_TIMEOUT = 5 * 60; // 5 minutes
export const UPGRADE_TIMEOUT_DEFAULT = 12 * 60; // 12 minutes

/**
 * Error codes
 */
export const ERR_CODE_CANCELLED = 99999;
export const ERR_CODE_INVALID_INPUT = 99998;
