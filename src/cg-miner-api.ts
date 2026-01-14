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
  str2int,
  str2float,
  parseCgminerBracketFormatStrIntoJson,
  longToBytes,
  toBytes,
} from './utils';

const ERR_CODE_cancelled = 99999;
export const kDefaultPort = 4028;

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
  [key: string]: any;
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
      this.response = response.toString('utf-8');
      this._responseDict = null;
    } else if (typeof response === 'string') {
      this.response = response;
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
        this._responseDict = JSON.parse(this.response) as CGMinerAPIResponse;
      } catch (e: any) {
        const errorStr = String(e);
        let sidx = 0;
        let eidx = 100;
        const peekLen = 50;

        const matched1 = errorStr.match(/.*\(\s*char\s+(\d+)\s*-\s*(\d+)\s*\).*/);
        if (matched1) {
          sidx = Math.min(
            Math.max((str2int(matched1[1]) ?? 0) - peekLen, 0),
            this.response.length
          );
          eidx = Math.min(
            Math.max((str2int(matched1[2]) ?? 0) + peekLen, sidx),
            this.response.length
          );
        } else {
          const matched2 = errorStr.match(/.*\(\s*char\s+(\d+).*/);
          if (matched2) {
            sidx = Math.min(
              Math.max((str2int(matched2[1]) ?? 0) - peekLen, 0),
              this.response.length
            );
            eidx = Math.min(sidx + 2 * peekLen, this.response.length);
          }
        }
        console.error(
          `load api response failed. ${sidx}:${eidx} <<<${this.response.substring(sidx, eidx)}>>>`
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

  successResponseDict(payloadKey: string): any {
    if (this.isRequestSuccess()) {
      const responseDict = this.responseDict();
      if (payloadKey in responseDict) {
        return responseDict[payloadKey];
      }
    }
    return null;
  }

  stats(): any {
    return this.successResponseDict('STATS');
  }

  summary(): any {
    return this.successResponseDict('SUMMARY');
  }

  devs(): any {
    return this.successResponseDict('DEVS');
  }

  pools(): any {
    return this.successResponseDict('POOLS');
  }

  debug(): any {
    return this.successResponseDict('DEBUG');
  }

  minerupgrade(): any {
    return this.successResponseDict('MINERUPGRADE');
  }

  version(): any {
    return this.successResponseDict('VERSION');
  }

  mm3SoftwareVersion(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      const versionObj = versionList[0];
      if ('VERSION' in versionObj) {
        return versionObj.VERSION;
      }
      return versionObj.VERION; // firmware has a typo at 2019.5.17
    }
    return undefined;
  }

  mm3UpgradeApiVersion(): number {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
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
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].MAC;
    }
    return undefined;
  }

  mm3Dna(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].DNA;
    }
    return undefined;
  }

  mm3ProductName(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].PROD;
    }
    return undefined;
  }

  mm3Model(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].MODEL;
    }
    return undefined;
  }

  mm3HardwareType(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].HWTYPE;
    }
    return undefined;
  }

  mm3SoftwareType(): string | undefined {
    const versionList = this.version();
    if (versionList && Array.isArray(versionList) && versionList.length > 0) {
      return versionList[0].SWTYPE;
    }
    return undefined;
  }
}

export interface RequestOptions {
  port?: number;
  firstTimeout?: number;
  retry?: number;
  useJsonCommand?: boolean;
  errorInfo?: Array<Record<string, any>>;
  autoRetryIfRefusedConn?: boolean;
  totalTimeout?: number;
}

export function requestCgminerApiBySock(
  ip: string,
  command: string,
  parameters: string | null,
  options: RequestOptions = {}
): CGMinerAPIResult {
  // Note: Synchronous version is not fully implemented in Node.js
  // For full async support, use aioRequestCgminerApiBySock
  throw new Error('Synchronous version not fully implemented. Use aioRequestCgminerApiBySock instead.');
}

// Simplified synchronous version - for full async version, see async implementation below
export async function aioRequestCgminerApiBySock(
  ip: string,
  command: string,
  parameters: string | null,
  options: RequestOptions & { cancelEvent?: AbortSignal } = {}
): Promise<CGMinerAPIResult> {
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

  if (cancelEvent?.aborted) {
    return canceledResult();
  }

  const totalStartTime = measurableTime();
  const params = parameters || '';
  let totalTimeoutErr = false;
  let tryTimes = 0;
  const bufferLen = 8 * 1024;
  let bufferList = Buffer.alloc(0);
  const errMsgs: string[] = [];
  let success = false;
  let scantime = Date.now() / 1000;
  let unlimitedRetryCount = 0;
  const apiRequestId = randomStrOnlyWithAlnum();

  while (!success && !totalTimeoutErr && tryTimes <= retry + unlimitedRetryCount) {
    if (cancelEvent?.aborted) {
      return canceledResult();
    }

    if (measurableTime() > totalStartTime + totalTimeout) {
      totalTimeoutErr = true;
      errMsgs.push('total timeout');
      break;
    }

    const startTime = Date.now() / 1000;
    if (!suppressLedCommandLog || params.indexOf(',led,') < 0) {
      console.debug(
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
      let receivedData: Buffer;

      while (true) {
        receivedData = await new Promise<Buffer>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Read timeout'));
          }, timeout * 1000);

          socket.once('data', (data: Buffer) => {
            clearTimeout(timeoutId);
            resolve(data);
          });

          socket.once('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
        });

        if (receivedData.length === 0) break;
        chunks.push(receivedData);

        if (measurableTime() > totalStartTime + totalTimeout) {
          totalTimeoutErr = true;
          throw new Error('total timeout');
        }
      }

      bufferList = Buffer.concat(chunks);
      success = true;
      socket.destroy();
    } catch (e: any) {
      const exceptErr: Record<string, any> = {};
      let isRefuseConn = false;

      if (errorInfo) {
        errorInfo.push(exceptErr);
      }

      if (e.message?.includes('timeout')) {
        exceptErr['timeout'] = true;
        exceptErr['connect_success'] = connectSuccess;
      }

      if (e.code === 'ECONNREFUSED') {
        exceptErr['socket_error_no'] = e.errno;
        isRefuseConn = true;
        if (autoRetryIfRefusedConn) {
          unlimitedRetryCount += 1;
          if (
            errorInfo &&
            errorInfo.length >= 2 &&
            errorInfo[errorInfo.length - 2]?.socket_error_no === e.errno
          ) {
            errorInfo.pop();
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (e.code === 'ECONNRESET') {
        unlimitedRetryCount += 1;
      }

      errMsgs.push(`${e.constructor.name}: ${e.message}`);
      bufferList = Buffer.alloc(0);

      if (e.code !== 'ECONNREFUSED' && e.code !== 'ECONNRESET' && !isRefuseConn) {
        console.error(
          `[${apiRequestId}] [ip ${ip} port ${port}] exception when run command ${command} with parameter ${params.substring(0, 60)}. err: ${e}`
        );
      }
    }

    if (!success && !cancelEvent?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const deltaTotalTime = measurableTime() - totalStartTime;
  let response: Buffer | string = '';

  if (success) {
    response = bufferList;
    console.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: success. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}`
    );
  } else if (totalTimeoutErr) {
    console.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: total timeout. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}`
    );
    errMsgs.push(`Total timeout. limit ${totalTimeout}, real ${deltaTotalTime}`);
  } else {
    console.info(
      `[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: other error. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}. err: ${errMsgs[errMsgs.length - 1]?.substring(0, 100) || 'no err msg'}`
    );
  }

  return new CGMinerAPIResult(success, scantime, response, tryTimes, errMsgs.join('\n'));
}

function canceledResult(): CGMinerAPIResult {
  return CGMinerAPIResult.errorResult(
    Date.now() / 1000,
    'has been canceled',
    CGMinerStatusCode.Cancelled
  );
}

export class CGMinerAPI {
  static defaultFirstTimeout = 5;

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
  ): Record<string, any> {
    const isSuccess = mulCmdR.isRequestSuccess();
    const allApiResults: Record<string, any> = { result: isSuccess };
    if (isSuccess) {
      for (const cmd of cmdList) {
        const cmdData = mulCmdR.successResponseDict(cmd);
        allApiResults[cmd] = new CGMinerAPIResult(
          mulCmdR.result,
          mulCmdR.scanTimestamp,
          Array.isArray(cmdData) && cmdData.length > 0 ? cmdData[0] : cmdData,
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
    errorInfo?: Array<Record<string, any>>
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
        return parsed['LED'] === 1;
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
      if (Array.isArray(debugData) && debugData.length > 0 && !debugData[0].Debug) {
        await CGMinerAPI.toggleDebug(ip, port, firstTimeout, retry);
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
    errorInfo?: Array<Record<string, any>>
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
    errorInfo?: Array<Record<string, any>>
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
    errorInfo?: Array<Record<string, any>>
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
    errorInfo?: Array<Record<string, any>>
  ): Promise<CGMinerAPIResult> {
    return await aioRequestCgminerApiBySock(ip, 'version', '', { port, firstTimeout, retry, errorInfo });
  }

  static async aioVersion(
    ip: string,
    port: number = kDefaultPort,
    firstTimeout: number = CGMinerAPI.defaultFirstTimeout,
    retry: number = 0,
    errorInfo?: Array<Record<string, any>>
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
    const cmdId = Math.floor(Math.random() * (65536 / 2)) + 1; // 2 bytes
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
