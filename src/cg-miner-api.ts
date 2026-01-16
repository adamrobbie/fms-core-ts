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

import * as net from 'net';
import {
  measurableTime,
  nowExactStr,
  randomStrOnlyWithAlnum,
  randomStrOnlyWithAlnumSecure,
  secureRandomInt,
  validateIP,
  validatePort,
  str2int,
  str2float,
  parseCgminerBracketFormatStrIntoJson,
  longToBytes,
  toBytes,
} from './utils';
import { logger } from './logger';
import type {
  CGMinerSummaryItem,
  CGMinerPoolItem,
  CGMinerDevItem,
  CGMinerEDevItem,
  CGMinerEStatsItem,
} from './cgminer-types';
import {
  DEFAULT_PORT,
  DEFAULT_FIRST_TIMEOUT,
  DEFAULT_RETRY_COUNT,
  DEFAULT_TOTAL_TIMEOUT,
  SOCKET_BUFFER_SIZE,
  CONNECTION_RETRY_DELAY,
  RETRY_SLEEP_DELAY,
  UPGRADE_HEADER_LENGTH,
  UPGRADE_UID_DEFAULT,
  UPGRADE_OFFSET_DEFAULT,
  UPGRADE_CMD_ID_MAX,
  UPGRADE_SUB_CMD,
  UPGRADE_RESERVED_BYTES_1,
  UPGRADE_RESERVED_BYTES_2,
  UPGRADE_VERSION_MAX_LENGTH,
  ERR_CODE_CANCELLED,
  ERR_CODE_INVALID_INPUT,
} from './constants';

export const kDefaultPort = DEFAULT_PORT;

let suppressLedCommandLog = false;

export enum CGMinerStatus {
  Warning = 'W',
  Informational = 'I',
  Success = 'S',
  Error = 'E',
  Fatal = 'F',
}

export enum CGMinerStatusCode {
  Cancelled = 99999,
  InvalidJson = 23,
  AscsetErr = 120,
}

export enum UpgradeErrCode {
  UPGRADE_ERR_APIVER = 1,
  UPGRADE_ERR_HEADER = 2,
  UPGRADE_ERR_FILESIZE = 3,
  UPGRADE_ERR_OFFSET = 4,
  UPGRADE_ERR_PAYLOAD = 5,
  UPGRADE_ERR_MALLOC = 6,
  UPGRADE_ERR_HARDWARE = 7,
  UPGRADE_ERR_AUP = 8,
  UPGRADE_ERR_UNKNOWN = 0xff,
}

export interface CGMinerAPIResponse {
  STATUS?: Array<{
    STATUS: string;
    When?: number;
    Code?: number;
    Msg?: string;
    Description?: string;
  }>;
  id?: number;
  [key: string]: unknown;
}

export interface VersionResponse {
  VERSION?: string;
  VERION?: string; // Typo in some firmware versions
  UPAPI?: number | string;
  MAC?: string;
  DNA?: string;
  PROD?: string;
  MODEL?: string;
  HWTYPE?: string;
  SWTYPE?: string;
  [key: string]: unknown;
}

function redactCommandParameters(command: string, params: string): string {
  const trimmed = params.length > 200 ? `${params.slice(0, 200)}…` : params;
  const cmd = command.toLowerCase();

  // Commands that may contain credentials or sensitive configuration
  if (cmd.includes('addpool')) {
    // Common format: url,user,pass (or similar). Redact user/pass.
    const parts = trimmed.split(',');
    if (parts.length >= 3) {
      const safe = [parts[0], '<redacted-user>', '<redacted-pass>', ...parts.slice(3).map(() => '<redacted>')];
      return safe.join(',');
    }
    return '<redacted>';
  }

  if (cmd.includes('config')) {
    // Config can include pool credentials or other secrets; do not log.
    return '<redacted>';
  }

  // Best-effort redaction for known key/value styles
  return trimmed.replace(/(pass(word)?\s*[:=]\s*)([^,\s]+)/gi, '$1<redacted>');
}

function trimTrailingControlChars(s: string): string {
  // Trim only *trailing* null bytes/control chars (common in CGMiner responses),
  // while preserving the content of JSON string values.
  return s.replace(/[\x00-\x1F\x7F]+$/g, '').trimEnd();
}

function sanitizeForJsonFallback(s: string): string {
  // Fallback sanitizer: remove null bytes and *non-whitespace* control chars.
  // Preserve \t (\x09), \n (\x0A), \r (\x0D) so JSON whitespace remains valid.
  return s
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

export class CGMinerAPIResult {
  static readonly KEY_STATUS = 'STATUS';
  static readonly KEY_When = 'When';
  static readonly KEY_Code = 'Code';
  static readonly KEY_Msg = 'Msg';
  static readonly KEY_Desc = 'Description';

  readonly result: boolean;
  readonly scanTimestamp: number;
  readonly response: string;
  private _responseDict: CGMinerAPIResponse | null = null;
  readonly tryTimes: number;
  readonly msg: string;

  constructor(
    result: boolean,
    scanTimestamp: number,
    response: string | Buffer | CGMinerAPIResponse,
    tryTimes: number,
    msg: string
  ) {
    this.result = result;
    this.scanTimestamp = scanTimestamp;
    this.tryTimes = tryTimes;
    this.msg = msg;

    if (Buffer.isBuffer(response)) {
      // Some miners null-terminate responses; trim only trailing control bytes.
      this.response = trimTrailingControlChars(response.toString('utf-8'));
      this._responseDict = null;
    } else if (typeof response === 'string') {
      // Some miners null-terminate responses; trim only trailing control bytes.
      this.response = trimTrailingControlChars(response);
      this._responseDict = null;
    } else {
      this.response = JSON.stringify(response);
      this._responseDict = response;
    }
  }

  static errorResult(when: number, msg: string, code: number = 14): CGMinerAPIResult {
    const response: CGMinerAPIResponse = {
      STATUS: [
        {
          STATUS: 'E',
          When: when,
          Code: str2int(String(code), 14) ?? 14,
          Msg: msg,
        },
      ],
      id: 1,
    };
    return new CGMinerAPIResult(true, Date.now() / 1000, response, 0, msg);
  }

  debugStr(): string {
    const msgPreview =
      this.msg.length < 300
        ? this.msg
        : `${this.msg.substring(0, 150)} ... ${this.msg.substring(this.msg.length - 150)}`;
    return `${this.result} ${this.scanTimestamp} ${this.response} ${msgPreview}`;
  }

  responseDict(): CGMinerAPIResponse {
    if (this._responseDict !== null) {
      return this._responseDict;
    }
    if (this.result && this.response.length > 0) {
      try {
        // Prefer a minimal cleanup: trim trailing control chars (common miner quirk).
        const primary = trimTrailingControlChars(this.response);
        try {
          this._responseDict = JSON.parse(primary) as CGMinerAPIResponse;
        } catch {
          // Fallback: remove null bytes and non-whitespace control chars.
          const fallback = sanitizeForJsonFallback(this.response);
          this._responseDict = JSON.parse(fallback) as CGMinerAPIResponse;
        }
      } catch (e: unknown) {
        const errorStr = e instanceof Error ? e.message : String(e);
        // Avoid logging raw response content (may contain sensitive config).
        logger.error(`load api response failed: ${errorStr}`);
        logger.debug(
          `api response parse failure (len=${this.response.length})`
        );
      }
    }
    if (this._responseDict === null) {
      this._responseDict = {};
    }
    return this._responseDict;
  }

  responseStr(): string {
    return this.response;
  }

  statusDict():
    | {
        STATUS: string;
        When?: number;
        Code?: number;
        Msg?: string;
        Description?: string;
      }
    | null {
    const rd = this.responseDict();
    if (rd && CGMinerAPIResult.KEY_STATUS in rd) {
      const statusArray = rd[CGMinerAPIResult.KEY_STATUS];
      if (Array.isArray(statusArray) && statusArray.length > 0) {
        return statusArray[0];
      }
    }
    return null;
  }

  isRequestSuccess(): boolean {
    if (this.result) {
      const status = this.status();
      return status === CGMinerStatus.Success || status === CGMinerStatus.Informational;
    }
    return false;
  }

  status(): CGMinerStatus {
    const statusDict = this.statusDict();
    if (statusDict) {
      try {
        return statusDict.STATUS as CGMinerStatus;
      } catch {
        return CGMinerStatus.Fatal;
      }
    }
    const responseDict = this.responseDict();
    if (typeof responseDict === 'object' && Object.keys(responseDict).length > 0) {
      return CGMinerStatus.Success;
    } else {
      return CGMinerStatus.Fatal;
    }
  }

  when(): number | null {
    const statusDict = this.statusDict();
    if (statusDict) {
      return str2float(String(statusDict[CGMinerAPIResult.KEY_When]), null);
    }
    return null;
  }

  statusMsg(): string | undefined {
    const statusDict = this.statusDict();
    return statusDict?.[CGMinerAPIResult.KEY_Msg];
  }

  statusCode(): number | undefined {
    const statusDict = this.statusDict();
    return statusDict?.[CGMinerAPIResult.KEY_Code];
  }

  successResponseDict(payloadKey: string): unknown[] | null {
    if (this.isRequestSuccess()) {
      const responseDict = this.responseDict();
      if (payloadKey in responseDict) {
        const payload = responseDict[payloadKey];
        if (Array.isArray(payload)) {
          return payload;
        }
      }
    }
    return null;
  }

  stats(): unknown[] | null {
    return this.successResponseDict('STATS');
  }

  summary(): unknown[] | null {
    return this.successResponseDict('SUMMARY');
  }

  /**
   * Returns summary data with TypeScript types applied.
   * 
   * Note: Types are best-effort and may not match all miner firmware variants.
   * CGMiner payload schemas vary across vendors and firmware versions.
   * Falls back to `summary()` if parsing fails.
   */
  summaryTyped(): CGMinerSummaryItem[] | null {
    const data = this.summary();
    if (!data || !Array.isArray(data)) return null;
    return data as CGMinerSummaryItem[];
  }

  devs(): unknown[] | null {
    return this.successResponseDict('DEVS');
  }

  /**
   * Returns device data with TypeScript types applied.
   * 
   * Note: Types are best-effort and may not match all miner firmware variants.
   * CGMiner payload schemas vary across vendors and firmware versions.
   */
  devsTyped(): CGMinerDevItem[] | null {
    const data = this.devs();
    if (!data || !Array.isArray(data)) return null;
    return data as CGMinerDevItem[];
  }

  pools(): unknown[] | null {
    return this.successResponseDict('POOLS');
  }

  /**
   * Returns pool data with TypeScript types applied.
   * 
   * Note: Types are best-effort and may not match all miner firmware variants.
   * CGMiner payload schemas vary across vendors and firmware versions.
   */
  poolsTyped(): CGMinerPoolItem[] | null {
    const data = this.pools();
    if (!data || !Array.isArray(data)) return null;
    return data as CGMinerPoolItem[];
  }

  /**
   * Extended devices payload returned by the `edevs` command.
   */
  edevs(): unknown[] | null {
    return this.successResponseDict('EDEVS');
  }

  /**
   * Returns extended device data with TypeScript types applied.
   * 
   * Note: Types are best-effort and may not match all miner firmware variants.
   * CGMiner payload schemas vary across vendors and firmware versions.
   */
  edevsTyped(): CGMinerEDevItem[] | null {
    const data = this.edevs();
    if (!data || !Array.isArray(data)) return null;
    return data as CGMinerEDevItem[];
  }

  /**
   * Extended stats payload returned by the `estats` command.
   */
  estats(): unknown[] | null {
    return this.successResponseDict('ESTATS');
  }

  /**
   * Returns extended stats data with TypeScript types applied.
   * 
   * Note: Types are best-effort and may not match all miner firmware variants.
   * CGMiner payload schemas vary across vendors and firmware versions.
   */
  estatsTyped(): CGMinerEStatsItem[] | null {
    const data = this.estats();
    if (!data || !Array.isArray(data)) return null;
    return data as CGMinerEStatsItem[];
  }

  debug(): unknown[] | null {
    return this.successResponseDict('DEBUG');
  }

  minerupgrade(): unknown[] | null {
    return this.successResponseDict('MINERUPGRADE');
  }

  version(): VersionResponse[] | null {
    const result = this.successResponseDict('VERSION');
    if (result && Array.isArray(result)) {
      return result as VersionResponse[];
    }
    return null;
  }

  mm3SoftwareVersion(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const versionObj = versionList[0];
      if ('VERSION' in versionObj && typeof versionObj.VERSION === 'string') {
        return versionObj.VERSION;
      }
      if ('VERION' in versionObj && typeof versionObj.VERION === 'string') {
        return versionObj.VERION; // firmware has a typo at 2019.5.17
      }
    }
    return undefined;
  }

  mm3UpgradeApiVersion(): number {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const versionObj = versionList[0];
      if ('UPAPI' in versionObj) {
        return str2int(String(versionObj.UPAPI), 1) ?? 1;
      }
      const ver = this.mm3SoftwareVersion();
      if (ver === '19062002_1e9d1b0_61887c8' || ver === '19062001_d9eaa2c_c0487dd') {
        return 2;
      }
      return 1;
    }
    return 1;
  }

  mm3Mac(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const mac = versionList[0].MAC;
      return typeof mac === 'string' ? mac : undefined;
    }
    return undefined;
  }

  mm3Dna(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const dna = versionList[0].DNA;
      return typeof dna === 'string' ? dna : undefined;
    }
    return undefined;
  }

  mm3ProductName(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const prod = versionList[0].PROD;
      return typeof prod === 'string' ? prod : undefined;
    }
    return undefined;
  }

  mm3Model(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const model = versionList[0].MODEL;
      return typeof model === 'string' ? model : undefined;
    }
    return undefined;
  }

  mm3HardwareType(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const hwtype = versionList[0].HWTYPE;
      return typeof hwtype === 'string' ? hwtype : undefined;
    }
    return undefined;
  }

  mm3SoftwareType(): string | undefined {
    const versionList = this.version();
    if (versionList && versionList.length > 0) {
      const swtype = versionList[0].SWTYPE;
      return typeof swtype === 'string' ? swtype : undefined;
    }
    return undefined;
  }
}

export interface SocketErrorInfo {
  timeout?: boolean;
  connect_success?: boolean;
  socket_error_no?: number;
  [key: string]: unknown;
}

export interface RequestOptions {
  port?: number;
  firstTimeout?: number;
  retry?: number;
  useJsonCommand?: boolean;
  errorInfo?: Array<SocketErrorInfo>;
  autoRetryIfRefusedConn?: boolean;
  totalTimeout?: number;
}

/**
 * Synchronous CGMiner API request (deprecated)
 * 
 * @deprecated This function is not fully implemented in Node.js due to the asynchronous nature
 * of Node.js sockets. Use `aioRequestCgminerApiBySock` instead for async/await support.
 * 
 * @throws {Error} Always throws an error directing users to use the async version
 */
export function requestCgminerApiBySock(
  ip: string,
  command: string,
  parameters: string | null,
  options: RequestOptions = {}
): CGMinerAPIResult {
  throw new Error(
    'Synchronous version not fully implemented in Node.js. ' +
    'Use aioRequestCgminerApiBySock() instead for async/await support.'
  );
}

// Simplified synchronous version - for full async version, see async implementation below
// Maximum response size to prevent DoS (10MB)
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
// Maximum unlimited retries to prevent resource exhaustion
const MAX_UNLIMITED_RETRIES = 10;
// Maximum parameter length to prevent DoS
const MAX_PARAM_LENGTH = 8192; // 8KB

export async function aioRequestCgminerApiBySock(
  ip: string,
  command: string,
  parameters: string | null,
  options: RequestOptions & { cancelEvent?: AbortSignal } = {}
): Promise<CGMinerAPIResult> {
  // Validate IP address
  if (!validateIP(ip)) {
    return CGMinerAPIResult.errorResult(
      Date.now() / 1000,
      `Invalid IP address format: ${ip}`,
      ERR_CODE_INVALID_INPUT
    );
  }

  const {
    port = kDefaultPort,
    firstTimeout = 2,
    retry = 0,
    useJsonCommand = true,
    errorInfo,
    autoRetryIfRefusedConn = true,
    totalTimeout = 30 * 60,
    cancelEvent,
  } = options;

  // Validate port number
  if (!validatePort(port)) {
    return CGMinerAPIResult.errorResult(
      Date.now() / 1000,
      `Invalid port number: ${port} (must be 1-65535)`,
      ERR_CODE_INVALID_INPUT
    );
  }

  // Validate parameter length
  const params = parameters || '';
  if (params.length > MAX_PARAM_LENGTH) {
    return CGMinerAPIResult.errorResult(
      Date.now() / 1000,
      `Parameter too long: ${params.length} bytes (max ${MAX_PARAM_LENGTH})`,
      ERR_CODE_INVALID_INPUT
    );
  }

  if (cancelEvent?.aborted) {
    return canceledResult();
  }

  const totalStartTime = measurableTime();
  const safeParamsForLog = redactCommandParameters(command, params);
  let totalTimeoutErr = false;
  let tryTimes = 0;
  const bufferLen = 8 * 1024;
  let bufferList = Buffer.alloc(0);
  const errMsgs: string[] = [];
  let success = false;
  let scantime = Date.now() / 1000;
  let unlimitedRetryCount = 0;
  const apiRequestId = randomStrOnlyWithAlnumSecure();

  while (!success && !totalTimeoutErr && tryTimes <= retry + unlimitedRetryCount) {
    if (cancelEvent?.aborted) {
      return canceledResult();
    }

    // Enforce maximum unlimited retry limit
    if (unlimitedRetryCount >= MAX_UNLIMITED_RETRIES) {
      errMsgs.push(`Maximum retry limit exceeded (${MAX_UNLIMITED_RETRIES})`);
      break;
    }

    if (measurableTime() > totalStartTime + totalTimeout) {
      totalTimeoutErr = true;
      errMsgs.push('total timeout');
      break;
    }

    const startTime = Date.now() / 1000;
    if (!suppressLedCommandLog || params.indexOf(',led,') < 0) {
      logger.debug(
        `[${apiRequestId}] [${nowExactStr()}] [ip ${ip} port ${port}] start command ${command} with parameter ${params.substring(0, 60)}`
      );
    }

    const timeout = Math.min(
      tryTimes + firstTimeout,
      Math.max(0.1, startTime + totalTimeout - Date.now() / 1000)
    );
    tryTimes += 1;
    let connectSuccess = false;

    try {
      const socket = await new Promise<net.Socket>((resolve, reject) => {
        const sock = new net.Socket();
        const timeoutId = setTimeout(() => {
          sock.destroy();
          reject(new Error('Connection timeout'));
        }, timeout * 1000);

        sock.connect(port, ip, () => {
          clearTimeout(timeoutId);
          resolve(sock);
        });

        sock.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      connectSuccess = true;
      scantime = Date.now() / 1000;

      const cmdJson = useJsonCommand
        ? JSON.stringify({ command, parameter: params })
        : `${command}|${params}`;

      socket.write(cmdJson, 'latin1');

      if (measurableTime() > totalStartTime + totalTimeout) {
        totalTimeoutErr = true;
        throw new Error('total timeout');
      }

      const chunks: Buffer[] = [];
      let streamEnded = false;
      let maxIterations = 1000; // Safety limit to prevent infinite loops
      let iterationCount = 0;
      let lastDataTime = Date.now();
      let totalResponseSize = 0; // Track total response size to prevent DoS

      // Set up end-of-stream handler
      socket.once('end', () => {
        streamEnded = true;
      });

      socket.once('close', () => {
        streamEnded = true;
      });

      // Helper to check if we have complete JSON (basic heuristic: balanced braces or null terminator)
      const hasCompleteResponse = (data: Buffer): boolean => {
        const str = data.toString('utf-8');
        // Check for null terminator (common in CGMiner responses)
        if (str.includes('\0')) return true;
        // Check for balanced JSON braces (simple heuristic)
        let openBraces = 0;
        let inString = false;
        let escapeNext = false;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') openBraces++;
            if (char === '}') {
              openBraces--;
              if (openBraces === 0 && i > 0) return true; // Complete JSON object
            }
          }
        }
        return false;
      };

      while (iterationCount < maxIterations) {
        iterationCount++;
        
        try {
          const receivedData = await new Promise<Buffer>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Read timeout'));
            }, timeout * 1000);

            const dataHandler = (data: Buffer) => {
              clearTimeout(timeoutId);
              socket.removeListener('error', errorHandler);
              resolve(data);
            };

            const errorHandler = (err: Error) => {
              clearTimeout(timeoutId);
              socket.removeListener('data', dataHandler);
              reject(err);
            };

            socket.once('data', dataHandler);
            socket.once('error', errorHandler);
          });

          if (receivedData.length === 0) {
            streamEnded = true;
            break;
          }
          
          // Enforce maximum response size to prevent DoS
          totalResponseSize += receivedData.length;
          if (totalResponseSize > MAX_RESPONSE_SIZE) {
            socket.destroy();
            throw new Error(`Response too large: ${totalResponseSize} bytes (max ${MAX_RESPONSE_SIZE})`);
          }
          
          chunks.push(receivedData);
          lastDataTime = Date.now();
          
          // Check if we have a complete response
          const combined = Buffer.concat(chunks);
          if (hasCompleteResponse(combined)) {
            // Got complete response, break out
            break;
          }

          if (measurableTime() > totalStartTime + totalTimeout) {
            totalTimeoutErr = true;
            throw new Error('total timeout');
          }
        } catch (readError: unknown) {
          // If stream ended, try to use what we have
          if (streamEnded) {
            break;
          }
          // If it's a read timeout and we have some data, wait a bit more for stream end
          if (readError instanceof Error && readError.message === 'Read timeout') {
            const timeSinceLastData = Date.now() - lastDataTime;
            // If we haven't received data in a while and stream hasn't ended, break
            if (timeSinceLastData > timeout * 1000 * 0.5) {
              break;
            }
            // Otherwise continue waiting
            continue;
          }
          throw readError;
        }
      }

      if (iterationCount >= maxIterations) {
        logger.warn(`Socket read reached maximum iterations (${maxIterations})`);
      }

      bufferList = Buffer.concat(chunks);
      success = true;
      socket.destroy();
    } catch (e: unknown) {
      const exceptErr: SocketErrorInfo = {};
      let isRefuseConn = false;
      const error = e instanceof Error && 'code' in e ? (e as NodeJS.ErrnoException) : null;

      if (errorInfo) {
        errorInfo.push(exceptErr);
      }

      if (error && error.message?.includes('timeout')) {
        exceptErr.timeout = true;
        exceptErr.connect_success = connectSuccess;
      }

      if (error && error.code === 'ECONNREFUSED') {
        exceptErr.socket_error_no = error.errno;
        isRefuseConn = true;
        if (autoRetryIfRefusedConn) {
          unlimitedRetryCount += 1;
          if (
            errorInfo &&
            errorInfo.length >= 2 &&
            errorInfo[errorInfo.length - 2]?.socket_error_no === error.errno
          ) {
            errorInfo.pop();
          }
          await new Promise((resolve) => setTimeout(resolve, CONNECTION_RETRY_DELAY));
        }
      }

      if (error && error.code === 'ECONNRESET') {
        unlimitedRetryCount += 1;
      }

      const errorName = error?.constructor?.name || 'Error';
      errMsgs.push(`${errorName}: ${error?.message || String(e)}`);
      bufferList = Buffer.alloc(0);

      if (error && error.code !== 'ECONNREFUSED' && error.code !== 'ECONNRESET' && !isRefuseConn) {
        logger.error(
          `[${apiRequestId}] [ip ${ip} port ${port}] exception when run command ${command} with parameter ${safeParamsForLog}. err: ${error}`
        );
      }
    }

    if (!success && !cancelEvent?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_SLEEP_DELAY));
    }
  }

  const deltaTotalTime = measurableTime() - totalStartTime;
  let response: Buffer | string = '';

  if (success) {
    response = bufferList;
    logger.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: success. command ${command} with parameter ${safeParamsForLog}. dt: ${deltaTotalTime}`
    );
  } else if (totalTimeoutErr) {
    logger.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: total timeout. command ${command} with parameter ${safeParamsForLog}. dt: ${deltaTotalTime}`
    );
    errMsgs.push(`Total timeout. limit ${totalTimeout}, real ${deltaTotalTime}`);
  } else {
    logger.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: other error. command ${command} with parameter ${safeParamsForLog}. dt: ${deltaTotalTime}. err: ${errMsgs[errMsgs.length - 1]?.substring(0, 100) || 'no err msg'}`
    );
  }

  return new CGMinerAPIResult(success, scantime, response, tryTimes, errMsgs.join('\n'));
}

function canceledResult(): CGMinerAPIResult {
  return CGMinerAPIResult.errorResult(
    Date.now() / 1000,
    'has been canceled',
    ERR_CODE_CANCELLED
  );
}

export class CGMinerAPI {
  static defaultFirstTimeout = 2; // Match aioRequestCgminerApiBySock default

  static async multipleReportCommands(
    ip: string,
    cmdList: string[],
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    totalTimeout: number = 30 * 60
  ): Promise<Record<string, any>> {
    const mulCmdR = await aioRequestCgminerApiBySock(ip, cmdList.join('+'), '', {
      port,
      firstTimeout,
      retry,
      totalTimeout,
    });
    return CGMinerAPI.splitMultipleReportApiResult(cmdList, mulCmdR);
  }

  static async aioMultipleReportCommands(
    ip: string,
    cmdList: string[],
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    totalTimeout: number = 30 * 60
  ): Promise<Record<string, any>> {
    const mulCmdR = await aioRequestCgminerApiBySock(ip, cmdList.join('+'), '', {
      port,
      firstTimeout,
      retry,
      totalTimeout,
    });
    return CGMinerAPI.splitMultipleReportApiResult(cmdList, mulCmdR);
  }

  static splitMultipleReportApiResult(
    cmdList: string[],
    mulCmdR: CGMinerAPIResult
  ): Record<string, CGMinerAPIResult | boolean> {
    const isSuccess = mulCmdR.isRequestSuccess();
    const allApiResults: Record<string, CGMinerAPIResult | boolean> = { result: isSuccess };
    if (isSuccess) {
      for (const cmd of cmdList) {
        const cmdData = mulCmdR.successResponseDict(cmd);
        const responseData = Array.isArray(cmdData) && cmdData.length > 0 
          ? JSON.stringify(cmdData[0])
          : cmdData !== null 
            ? JSON.stringify(cmdData)
            : '';
        allApiResults[cmd] = new CGMinerAPIResult(
          mulCmdR.result,
          mulCmdR.scanTimestamp,
          responseData,
          mulCmdR.tryTimes,
          mulCmdR.msg
        );
      }
    } else {
      allApiResults['raw'] = mulCmdR;
    }
    return allApiResults;
  }

  static async estats(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'estats', '', { port, firstTimeout, retry });
  }

  static async devs(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'devs', '', { port, firstTimeout, retry });
  }

  static async edevs(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'edevs', '', { port, firstTimeout, retry });
  }

  static async summary(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'summary', '', { port, firstTimeout, retry });
  }

  static async pools(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'pools', '', { port, firstTimeout, retry });
  }

  /**
   * Add a new mining pool
   * @param ip Miner IP address
   * @param url Pool URL (e.g., "stratum+tcp://pool.example.com:3333")
   * @param user Username/worker name
   * @param password Pool password (optional)
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async addPool(
    ip: string,
    url: string,
    user: string,
    password: string = '',
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    const parameter = `${url},${user},${password}`;
    return await aioRequestCgminerApiBySock(ip, 'addpool', parameter, {
      port,
      firstTimeout,
      retry,
    });
  }

  /**
   * Remove a pool by index
   * @param ip Miner IP address
   * @param poolIndex Pool index to remove (0-based)
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async removePool(
    ip: string,
    poolIndex: number,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'removepool', String(poolIndex), {
      port,
      firstTimeout,
      retry,
    });
  }

  /**
   * Switch to a different pool
   * @param ip Miner IP address
   * @param poolIndex Pool index to switch to (0-based)
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async switchPool(
    ip: string,
    poolIndex: number,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'switchpool', String(poolIndex), {
      port,
      firstTimeout,
      retry,
    });
  }

  /**
   * Enable a pool
   * @param ip Miner IP address
   * @param poolIndex Pool index to enable (0-based)
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async enablePool(
    ip: string,
    poolIndex: number,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'enablepool', String(poolIndex), {
      port,
      firstTimeout,
      retry,
    });
  }

  /**
   * Disable a pool
   * @param ip Miner IP address
   * @param poolIndex Pool index to disable (0-based)
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async disablePool(
    ip: string,
    poolIndex: number,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'disablepool', String(poolIndex), {
      port,
      firstTimeout,
      retry,
    });
  }

  /**
   * Get or set miner configuration
   * @param ip Miner IP address
   * @param config Optional configuration string to set
   * @param port Miner API port
   * @param firstTimeout Initial timeout in seconds
   * @param retry Number of retries
   * @returns CGMinerAPIResult
   */
  static async config(
    ip: string,
    config: string = '',
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'config', config, {
      port,
      firstTimeout,
      retry,
    });
  }

  static async toggleLED(
    ip: string,
    devId: string,
    modId: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'ascset', `${devId},led,${modId}`, {
      port,
      firstTimeout,
      retry,
    });
  }

  static async turnLED(
    ip: string,
    devId: string,
    modId: string,
    turnOn: boolean,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(
      ip,
      'ascset',
      `${devId},led,${modId}-${turnOn ? 1 : 0}`,
      { port, firstTimeout, retry }
    );
  }

  static async queryA10LED(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<boolean | null> {
    const response = await aioRequestCgminerApiBySock(ip, 'ascset', '0,led,0-255', {
      port,
      firstTimeout,
      retry,
      errorInfo,
    });
    if (response.result) {
      const msg = response.statusMsg();
      if (msg) {
        const parsed = parseCgminerBracketFormatStrIntoJson(msg);
        const ledValue = parsed['LED'];
        return typeof ledValue === 'number' ? ledValue === 1 : null;
      }
    }
    return null;
  }

  static async toggleDebug(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'debug', 'd', { port, firstTimeout, retry });
  }

  static async getDebugStatus(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'debug', '', { port, firstTimeout, retry });
  }

  static async turnOnDebug(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<boolean> {
    const debugResult = await CGMinerAPI.getDebugStatus(ip, port, firstTimeout, retry);
    if (debugResult.isRequestSuccess()) {
      const debugData = debugResult.debug();
      if (Array.isArray(debugData) && debugData.length > 0) {
        const firstDebug = debugData[0] as Record<string, unknown>;
        if (!firstDebug.Debug) {
          await CGMinerAPI.toggleDebug(ip, port, firstTimeout, retry);
        }
      }
      return true;
    } else {
      return false;
    }
  }

  static async reboot(
    ip: string,
    devId: string,
    modId: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'ascset', `${devId},reboot,${modId}`, {
      port,
      firstTimeout,
      retry,
    });
  }

  static async rebootMm3(
    ip: string,
    lastWhen: number = 0,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'ascset', `0,reboot,${lastWhen}`, {
      port,
      firstTimeout,
      retry,
      errorInfo,
    });
  }

  static async aioRebootMm3(
    ip: string,
    lastWhen: number = 0,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'ascset', `0,reboot,${lastWhen}`, {
      port,
      firstTimeout,
      retry,
      errorInfo,
    });
  }

  static async mm3SetWorkmode(
    ip: string,
    workmode: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'ascset', `0,workmode,${workmode}`, {
      port,
      firstTimeout,
      retry,
      errorInfo,
    });
  }

  static async version(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'version', '', { port, firstTimeout, retry, errorInfo });
  }

  static async aioVersion(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<SocketErrorInfo>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'version', '', {
      port,
      firstTimeout,
      retry,
      errorInfo,
    });
  }

  static async mm3Upgrade(
    ip: string,
    uid: number,
    apiVersion: number,
    version: string,
    fileSize: number,
    offset: number,
    payloadLen: number,
    payload: Buffer,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    useJsonCommand: boolean = true
  ): Promise<CGMinerAPIResult> {
    const paramStr = CGMinerAPI._prepareUpgradeParam(
      apiVersion,
      fileSize,
      ip,
      offset,
      payload,
      payloadLen,
      uid,
      version
    );
    return await aioRequestCgminerApiBySock(ip, 'ascset', '0,upgrade,' + paramStr, {
      port,
      firstTimeout,
      retry,
    });
  }

  static async aioMm3Upgrade(
    ip: string,
    uid: number,
    apiVersion: number,
    version: string,
    fileSize: number,
    offset: number,
    payloadLen: number,
    payload: Buffer,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    useJsonCommand: boolean = true
  ): Promise<CGMinerAPIResult> {
    const paramStr = CGMinerAPI._prepareUpgradeParam(
      apiVersion,
      fileSize,
      ip,
      offset,
      payload,
      payloadLen,
      uid,
      version
    );
    return await aioRequestCgminerApiBySock(ip, 'ascset', '0,upgrade,' + paramStr, {
      port,
      firstTimeout,
      retry,
    });
  }

  private static _prepareUpgradeParam(
    apiVersion: number,
    fileSize: number,
    ip: string,
    offset: number,
    payload: Buffer,
    payloadLen: number,
    uid: number,
    version: string
  ): string {
    const endianness: 'little' = 'little';
    const param: Buffer[] = [];
    const endianFlag = 0b0; // 0 for little endian, 1 for big endian
    const apiVer = apiVersion;
    const byte0 = (endianFlag << 7) | apiVer;
    param.push(longToBytes(byte0, 1, endianness));
    const headerLen = 30; // header bytes count
    param.push(longToBytes(headerLen, 1, endianness));
    // Use cryptographically secure random for command ID
    const cmdId = secureRandomInt(1, UPGRADE_CMD_ID_MAX + 1); // 2 bytes
    param.push(longToBytes(cmdId, 2, endianness));
    const subCmd = 0x0; // always 0
    param.push(longToBytes(subCmd, 1, endianness));
    const reserved1 = 0x0; // 3 bytes
    param.push(longToBytes(reserved1, 3, endianness));
    param.push(longToBytes(uid, 4, endianness));
    const versionBytes = version.substring(0, 8).padEnd(8, '\0');
    param.push(toBytes(versionBytes));
    param.push(longToBytes(fileSize, 4, endianness));
    param.push(longToBytes(offset, 4, endianness));
    param.push(longToBytes(payloadLen, 2, endianness));
    const reserved2 = 0x0; // 2 bytes
    param.push(longToBytes(reserved2, 2, endianness));
    param.push(payload);

    const combined = Buffer.concat(param);
    return Array.from(combined)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
