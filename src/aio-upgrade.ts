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

import {
  CGMinerAPI,
  CGMinerAPIResult,
  CGMinerStatus,
  CGMinerStatusCode,
  UpgradeErrCode,
} from './cg-miner-api';
import { AUPFile } from './aup-file';
import { str2int, str2float, firmwareDateStr } from './utils';
import { logger } from './logger';
import {
  UPGRADE_UID_DEFAULT,
  UPGRADE_OFFSET_DEFAULT,
  REBOOT_TIMEOUT,
  VERSION_CHECK_TIMEOUT,
  UPGRADE_TIMEOUT_DEFAULT,
} from './constants';

const kUpgradeErrRe = /.*\s+Err(\d+):/;
const kUpgradeErrUnexpectedOffsetRe =
  /.*\s+Err(\d+):\s*offset\s+\(([0-9a-z]+)\)\s+is\s+not\s+expected\s+\(([0-9a-z]+)\)/;

export enum UpgradeResults {
  success = 0,
  alreadyUpgraded = 1,
  noPrevVer = -1,
  rebootTimeout = -2,
  upgradeTimeout = -3,
  unexpectedError = -4,
  unexpectedFinalVer = -5,
  outOfMemory = -6,
  mismatchHwtype = -7,
  mismatchSwtype = -8,
  cancelled = -9,
  apiVerMismatch = -10,
  invalidHeader = -11,
  fileSizeMismatch = -12,
  payload = -13,
  aup = -14,
}

export function upgradeResultsFromUpgradeErrCode(errCode: UpgradeErrCode): UpgradeResults {
  switch (errCode) {
    case UpgradeErrCode.UPGRADE_ERR_APIVER:
      return UpgradeResults.apiVerMismatch;
    case UpgradeErrCode.UPGRADE_ERR_HEADER:
      return UpgradeResults.invalidHeader;
    case UpgradeErrCode.UPGRADE_ERR_FILESIZE:
      return UpgradeResults.fileSizeMismatch;
    case UpgradeErrCode.UPGRADE_ERR_PAYLOAD:
      return UpgradeResults.payload;
    case UpgradeErrCode.UPGRADE_ERR_MALLOC:
      return UpgradeResults.outOfMemory;
    case UpgradeErrCode.UPGRADE_ERR_HARDWARE:
      return UpgradeResults.mismatchHwtype;
    case UpgradeErrCode.UPGRADE_ERR_AUP:
      return UpgradeResults.aup;
    default:
      return UpgradeResults.unexpectedError;
  }
}

export const upgradeResultDisplay: Record<UpgradeResults, string> = {
  [UpgradeResults.success]: 'upgrade success',
  [UpgradeResults.alreadyUpgraded]: 'already upgraded, no new upgrade',
  [UpgradeResults.noPrevVer]: 'get prev ver failed',
  [UpgradeResults.rebootTimeout]: 'timeout when reboot after upgrade',
  [UpgradeResults.upgradeTimeout]: 'timeout when upgrade',
  [UpgradeResults.unexpectedError]: 'unexpected error occur',
  [UpgradeResults.unexpectedFinalVer]: 'unexpected final ver',
  [UpgradeResults.outOfMemory]: 'out of memory',
  [UpgradeResults.mismatchHwtype]: 'hardware mismatch',
  [UpgradeResults.mismatchSwtype]: 'software mismatch',
  [UpgradeResults.cancelled]: 'cancelled',
  [UpgradeResults.apiVerMismatch]: 'API ver mismatch',
  [UpgradeResults.invalidHeader]: 'invalid header',
  [UpgradeResults.fileSizeMismatch]: 'file size mismatch',
  [UpgradeResults.payload]: 'payload',
  [UpgradeResults.aup]: 'aup',
};

export enum UpgradeStatus {
  Prepare = 'prepare',
  PreCheckVer = 'pre_check_ver',
  TransferFirmware = 'transfer_firmware',
  Reboot = 'reboot',
  PostCheckVer = 'post_check_ver',
  Finish = 'finish',
}

export interface UpgradeProgressInfo {
  ip: string;
  port: number;
  ratio: number;
  status: UpgradeStatus;
  result?: UpgradeResults;
}

export type ProgressReportFunction = (
  ratio: number | UpgradeResults,
  status: UpgradeStatus
) => void;

export async function aioMm3Upgrade(
  ip: string,
  port: number,
  apiVersion: number,
  version: string,
  payload: Buffer,
  pageLen: number = 888,
  timeout: number = 10 * 60,
  enablePreVerCheck: boolean = true,
  progressReportFxn?: ProgressReportFunction,
  supportedHwtypeList?: string[],
  supportedSwtypeList?: string[],
  aupFile?: AUPFile
): Promise<[boolean, UpgradeResults]> {
  let upgradeResult = UpgradeResults.unexpectedError;

  try {
    logger.info(`upgrade start. ip ${ip}`);
    const maxGetVerSeconds = VERSION_CHECK_TIMEOUT;

    if (progressReportFxn) {
      progressReportFxn(0, UpgradeStatus.PreCheckVer);
    }

    const precheckTuple = await aioMm3UpgradePrecheck(
      enablePreVerCheck,
      ip,
      port,
      version,
      maxGetVerSeconds,
      supportedHwtypeList,
      supportedSwtypeList
    );

    const [preCheckErr, preCheckResult, prevVer, prevWhenInitial, upapiVer] = precheckTuple;
    let prevWhen = prevWhenInitial;

    if (preCheckResult !== null) {
      upgradeResult = preCheckErr;
      return [preCheckResult, upgradeResult];
    }

    let actualApiVersion = apiVersion;
    if (actualApiVersion <= 0) {
      actualApiVersion = upapiVer;
    }

    let actualPayload = payload;
    if (actualApiVersion < 2) {
      if (aupFile && aupFile.header().isLegal()) {
        actualPayload = payload.subarray(aupFile.header().totalLen());
      } else {
        actualPayload = payload.subarray(92);
      }
    } else {
      actualPayload = hackAupHeaderWhenCrossAupHeaderVerUpgrade(
        payload,
        aupFile,
        prevVer || ''
      );
    }

    // distribute payload/firmware
    const fileSize = actualPayload.length;
    const rebootProgressRatio = 0.1;
    const precheckProgressRatio = ((1 - rebootProgressRatio) * pageLen) / fileSize;
    const upgradeProgressRatio = 1 - precheckProgressRatio - rebootProgressRatio;
    let offset = 0;
    const startTime = Date.now() / 1000;
    let uid = Math.floor(startTime);
    let timeoutError = false;
    let payloadLen = 0;

    if (progressReportFxn) {
      progressReportFxn(precheckProgressRatio, UpgradeStatus.TransferFirmware);
    }

    while (offset < fileSize) {
      let success = false;
      let repeatTimesForSameOffset = 0;
      let shouldResetOffsetTo: number | null = null;

      while (!success) {
        const endPos = Math.min(offset + pageLen, fileSize);
        payloadLen = endPos - offset;
        const payloadPart = actualPayload.subarray(offset, endPos);
        let result: CGMinerAPIResult | null = null;

        try {
          logger.debug(
            `api call at ${new Date().toISOString()} ${(Date.now() / 1000 - startTime).toFixed(1)} ip: ${ip} port: ${port}`
          );

          result = await CGMinerAPI.aioMm3Upgrade(
            ip,
            uid,
            actualApiVersion,
            version,
            fileSize,
            offset,
            payloadLen,
            payloadPart,
            port,
            endPos !== fileSize ? 10 : 90
          );

          if (result && result.statusCode() === CGMinerStatusCode.Cancelled) {
            throw new Error('Cancelled');
          }

          if (result.result) {
            const when = result.when();
            if (when !== null) {
              prevWhen = when;
            }
          }

          logger.debug(`${ip} upgrade package result: ${result.debugStr()}`);
          success = result.isRequestSuccess();
        } catch (e: unknown) {
          const error = e as Error;
          if (error.message === 'Cancelled') {
            throw e;
          }
          logger.error(`ip ${ip} port ${port} exception ${error.message || String(e)}`);
        }

        if (!success && Date.now() / 1000 > startTime + timeout) {
          logger.debug(
            `${ip}:${port} upgrade timeout: from ${startTime} to ${Date.now() / 1000}`
          );
          timeoutError = true;
          break;
        } else if (result && result.status() === CGMinerStatus.Error) {
          if (result.statusCode() === CGMinerStatusCode.AscsetErr) {
            const msg = result.statusMsg();
            if (msg) {
              const errMatched = kUpgradeErrRe.exec(msg);
              if (errMatched) {
                const errCode = str2int(errMatched[1], null);
                if (errCode === UpgradeErrCode.UPGRADE_ERR_OFFSET) {
                  const errMatched2 = kUpgradeErrUnexpectedOffsetRe.exec(msg);
                  if (errMatched2) {
                    const expectedOffsetStr = errMatched2[2];
                    shouldResetOffsetTo = str2int(expectedOffsetStr, null) ?? 0;
                  } else {
                    shouldResetOffsetTo = 0;
                  }
                  break;
                } else {
                  const resultEnum = upgradeResultsFromUpgradeErrCode(errCode!);
                  logger.error(
                    `upgrade result: err code ${errCode} ${resultEnum}. ip ${ip}:${port}`
                  );
                  upgradeResult = resultEnum;
                  return [false, upgradeResult];
                }
              }
            }
          }
          repeatTimesForSameOffset += 1;
          logger.debug(
            `repeat for error. repeat_times_for_same_offset ${repeatTimesForSameOffset} at ${ip}:${port}`
          );

          const minPageLen = 500;
          if (result.statusCode() === CGMinerStatusCode.InvalidJson) {
            if (pageLen > minPageLen && repeatTimesForSameOffset % 3 === 2) {
              pageLen = Math.max(pageLen - 50, Math.floor(pageLen / 2), minPageLen);
            }
          } else {
            // Avoid logging raw responses here; it may contain sensitive configuration.
            logger.info(
              `cgminer api error: ip: ${ip}:${port}, status=${result.status()} code=${result.statusCode()} msg=${result.statusMsg() || ''}`
            );
          }
        }
      }

      offset += payloadLen;
      if (shouldResetOffsetTo !== null) {
        logger.error(
          `offset reset from ${offset} to ${shouldResetOffsetTo} for ${ip}:${port}`
        );
        offset = shouldResetOffsetTo;
        if (shouldResetOffsetTo === 0) {
          const oldUid = uid;
          uid = Math.floor(Date.now() / 1000);
          logger.info(`${ip}:${port} uid changed from ${oldUid} to ${uid}`);
        }
      }

      if (progressReportFxn) {
        progressReportFxn(
          precheckProgressRatio + (upgradeProgressRatio * offset) / fileSize,
          UpgradeStatus.TransferFirmware
        );
      }

      if (Date.now() / 1000 > startTime + timeout) {
        timeoutError = true;
        break;
      }
    }

        logger.info(
      `upgrade finish ip: ${ip}:${port} ds: ${((Date.now() / 1000 - startTime).toFixed(1))}`
    );

    if (!timeoutError) {
      if (progressReportFxn) {
        progressReportFxn(precheckProgressRatio + upgradeProgressRatio, UpgradeStatus.Reboot);
      }

        logger.info(`begin reboot ip: ${ip}:${port} ds: ${((Date.now() / 1000 - startTime).toFixed(1))}`);

      const startTs = Date.now() / 1000;
      const maxAllowedWhenRebootSeconds = 5 * 60;
      const maxAllowedZeroRebootSeconds = 1 * 60;
      const maxAllowedRebootSeconds =
        maxAllowedWhenRebootSeconds + maxAllowedZeroRebootSeconds;
      let newVer: string | null = null;
      let newWhen: number | null = null;
      let upapiVerFinal = 1;
      let rebootWhen = Math.max(prevWhen || 0, 15);
      let rebootSuccess = false;
      let maxGetVerSecondsAfterReboot = maxGetVerSeconds;
      const tsBeforeStartReboot = Date.now() / 1000;

      while (true) {
        logger.debug(`reboot ip: ${ip}:${port} ds: ${((Date.now() / 1000 - startTime).toFixed(1))}`);

        const errorInfo: Array<Record<string, unknown>> = [];
        const rebootResult = await CGMinerAPI.aioRebootMm3(
          ip,
          rebootWhen,
          port,
          undefined,
          0,
          errorInfo
        );

        if (
          rebootResult &&
          rebootResult.statusCode() === CGMinerStatusCode.Cancelled
        ) {
          throw new Error('Cancelled');
        }

        if (errorInfo.length > 0) {
          logger.debug(`reboot ${ip}:${port} error info: ${errorInfo}`);

          if (
            rebootWhen === 0 &&
            rebootResult !== null &&
            !rebootResult.result
          ) {
            const latestErrInfo = errorInfo[errorInfo.length - 1];
            if (latestErrInfo.timeout && latestErrInfo.connect_success) {
              logger.debug('timeout is acceptable for MM3 firmware right now');
              const maxAllowedRestartSeconds = 3 * 60;
              const [, tmpWhen] = await aioGetVerWhenAndUpapi(
                ip,
                maxAllowedRestartSeconds,
                port
              );

              if (
                tmpWhen !== null &&
                tmpWhen < (prevWhen || 0) + (Date.now() / 1000 - tsBeforeStartReboot)
              ) {
                maxGetVerSecondsAfterReboot = 60;
                rebootSuccess = true;
                break;
              }
            }
          }
        }

        if (
          rebootResult !== null &&
          rebootResult.result &&
          !rebootResult.isRequestSuccess() &&
          rebootResult.statusMsg()?.includes('Wrong parameter') &&
          (rebootResult.when() || 0) < Math.max(prevWhen || 0, 30)
        ) {
          logger.debug(
            `this reboot request failed with smaller when ${prevWhen}:${rebootResult.when()}, so reboot success`
          );
          rebootSuccess = true;
          break;
        }

        // Avoid debugStr() here (it includes raw response). Log only the status summary.
        logger.info(
          `reboot ${ip}:${port} result: status=${rebootResult?.status()} code=${rebootResult?.statusCode()} msg=${rebootResult?.statusMsg() || ''}`
        );

        if (progressReportFxn) {
          progressReportFxn(
            precheckProgressRatio + upgradeProgressRatio,
            UpgradeStatus.Reboot
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 300));

        if (Date.now() / 1000 > startTs + maxAllowedRebootSeconds) {
          logger.info(
            `${ip}:${port} reboot timeout from ${startTs} to ${Date.now() / 1000}`
          );
          timeoutError = true;
          break;
        } else if (Date.now() / 1000 > startTs + maxAllowedWhenRebootSeconds) {
          rebootWhen = 0;
        }
      }

      logger.info(`end reboot ip: ${ip}:${port} ds: ${((Date.now() / 1000 - startTime).toFixed(1))}`);

      if (timeoutError) {
        logger.info(
          `upgrade result: failed. ip: ${ip}:${port} failed for reboot timeout`
        );
        upgradeResult = UpgradeResults.rebootTimeout;
        return [false, upgradeResult];
      }

      if (rebootSuccess) {
        if (progressReportFxn) {
          progressReportFxn(
            precheckProgressRatio + upgradeProgressRatio,
            UpgradeStatus.PostCheckVer
          );
        }

        [newVer, newWhen, upapiVerFinal] = await aioGetVerWhenAndUpapi(
          ip,
          maxGetVerSecondsAfterReboot,
          port
        );
      }

      if (
        newVer &&
        newVer.startsWith(version) &&
        newWhen !== null &&
        newWhen < (prevWhen || 0)
      ) {
        logger.debug(
          `upgrade result: success. ip: ${ip}, prev ver: ${prevVer} prev when: ${prevWhen}, new ver: ${newVer} new when ${newWhen}`
        );
        upgradeResult = UpgradeResults.success;
        return [true, upgradeResult];
      } else {
        logger.debug(
          `upgrade result: failed. ip: ${ip}, prev ver: ${prevVer} prev when: ${prevWhen}, target ver: ${version}, new ver: ${newVer} new when ${newWhen}`
        );
        upgradeResult = UpgradeResults.unexpectedFinalVer;
        return [false, upgradeResult];
      }
    } else {
        logger.info(`upgrade result: failed. ip: ${ip}:${port} failed for timeout`);
      upgradeResult = UpgradeResults.upgradeTimeout;
      return [false, upgradeResult];
    }
  } catch (e: unknown) {
    const error = e as Error;
    if (error.message === 'Cancelled') {
        logger.info(`upgrade result: cancelled. ip ${ip}:${port}`);
      upgradeResult = UpgradeResults.cancelled;
      return [false, upgradeResult];
    }
    logger.error(`upgrade result: failed. ip ${ip}:${port} upgrade exception: ${e instanceof Error ? e.message : String(e)}`);
    upgradeResult = UpgradeResults.unexpectedError;
    return [false, upgradeResult];
  } finally {
        logger.info(`upgrade end. ip ${ip}:${port}`);
    if (progressReportFxn) {
      progressReportFxn(upgradeResult, UpgradeStatus.Finish);
    }
  }
}

async function aioMm3UpgradePrecheck(
  enablePreVerCheck: boolean,
  ip: string,
  port: number,
  targetVersion: string,
  maxGetVerSeconds: number,
  supportedHwtypeList?: string[],
  supportedSwtypeList?: string[]
): Promise<[UpgradeResults, boolean | null, string | null, number | null, number]> {
  let preCheckResult: boolean | null = null;
  let preCheckErr = UpgradeResults.unexpectedError;

  const [prevVer, prevWhen, upapiVer, hwtype, swtype] = await aioGetVerWhenAndUpapi(
    ip,
    maxGetVerSeconds,
    port
  );

  if (prevVer === null || prevVer.length === 0) {
    if (enablePreVerCheck) {
      preCheckResult = false;
      preCheckErr = UpgradeResults.noPrevVer;
    } else {
      logger.warn(`ip ${ip}:${port} no prev ver`);
    }
  } else if (prevVer.startsWith(targetVersion)) {
    logger.warn(`same ver at ip ${ip}:${port}, no upgrade is needed`);
    preCheckResult = true;
    preCheckErr = UpgradeResults.alreadyUpgraded;
  }

  if (
    supportedHwtypeList &&
    supportedHwtypeList.length > 0 &&
    hwtype &&
    !supportedHwtypeList.includes(hwtype)
  ) {
    logger.warn(
      `ver hwtype mismatch: cur ver ${prevVer}, cur hwtype ${hwtype}, target ver: ${targetVersion}, hwtype list ${supportedHwtypeList}`
    );
    preCheckResult = false;
    preCheckErr = UpgradeResults.mismatchHwtype;
  }

  if (
    supportedSwtypeList &&
    supportedSwtypeList.length > 0 &&
    swtype &&
    !supportedSwtypeList.includes(swtype)
  ) {
    logger.warn(
      `ver swtype mismatch: cur ver ${prevVer}, cur swtype ${swtype}, target ver: ${targetVersion}, swtype list ${supportedSwtypeList}`
    );
    preCheckResult = false;
    preCheckErr = UpgradeResults.mismatchSwtype;
  }

  return [preCheckErr, preCheckResult, prevVer, prevWhen, upapiVer];
}

async function aioGetVerWhenAndUpapi(
  ip: string,
  maxGetVerSeconds: number,
  port: number
): Promise<[string | null, number | null, number, string | null, string | null]> {
  let timeoutError = false;
  const startTs = Date.now() / 1000;
  let prevVer: string | null = null;
  let prevWhen: number | null = null;
  let prevUpapiVer = 1;
  let hwtype: string | null = null;
  let swtype: string | null = null;

  while (true) {
    if (prevVer === null) {
      const verResult = await CGMinerAPI.aioVersion(
        ip,
        port,
        Math.max(10, Math.min(maxGetVerSeconds, 60)),
        0
      );

      if (verResult && verResult.statusCode() === CGMinerStatusCode.Cancelled) {
        throw new Error('Cancelled');
      }

      if (verResult.isRequestSuccess()) {
        prevVer = verResult.mm3SoftwareVersion() || null;
        prevWhen = str2int(String(verResult.when()), 60);
        prevUpapiVer = verResult.mm3UpgradeApiVersion();
        hwtype = verResult.mm3HardwareType() || null;
        swtype = verResult.mm3SoftwareType() || null;
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (Date.now() / 1000 > startTs + maxGetVerSeconds) {
      timeoutError = true;
      break;
    }
  }

  if (timeoutError) {
    logger.error(`ip: ${ip}:${port} failed for getting version timeout`);
  }

  return [prevVer, prevWhen, prevUpapiVer, hwtype, swtype];
}

function hackAupHeaderWhenCrossAupHeaderVerUpgrade(
  payload: Buffer,
  aupFile: AUPFile | undefined,
  runningVer: string
): Buffer {
  if (aupFile && aupFile.is1066()) {
    const dateStr = firmwareDateStr(runningVer);
    let useAupVer: number | null = null;

    if (dateStr <= '19102501') {
      useAupVer = 0;
    } else {
      useAupVer = 2;
    }

    if (useAupVer !== null && useAupVer !== aupFile.header().aupHeaderVer()) {
      const originalHeaderLen = aupFile.header().totalLen();
      const headerPayload = aupFile.generateAupHeaderPayload(useAupVer);
      // Avoid `Array.from()` + VirtualListAdder + per-byte push (very expensive for large payloads).
      // Result is: [newHeader] + [payload without original header prefix]
      return Buffer.concat([headerPayload, payload.subarray(originalHeaderLen)]);
    }
  }

  return payload;
}
