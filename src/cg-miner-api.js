"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CGMinerAPI = exports.CGMinerAPIResult = exports.UpgradeErrCode = exports.CGMinerStatusCode = exports.CGMinerStatus = exports.kDefaultPort = void 0;
exports.requestCgminerApiBySock = requestCgminerApiBySock;
exports.aioRequestCgminerApiBySock = aioRequestCgminerApiBySock;
const net = __importStar(require("net"));
const utils_1 = require("./utils");
const ERR_CODE_cancelled = 99999;
exports.kDefaultPort = 4028;
let suppressLedCommandLog = false;
var CGMinerStatus;
(function (CGMinerStatus) {
    CGMinerStatus["Warning"] = "W";
    CGMinerStatus["Informational"] = "I";
    CGMinerStatus["Success"] = "S";
    CGMinerStatus["Error"] = "E";
    CGMinerStatus["Fatal"] = "F";
})(CGMinerStatus || (exports.CGMinerStatus = CGMinerStatus = {}));
var CGMinerStatusCode;
(function (CGMinerStatusCode) {
    CGMinerStatusCode[CGMinerStatusCode["Cancelled"] = 99999] = "Cancelled";
    CGMinerStatusCode[CGMinerStatusCode["InvalidJson"] = 23] = "InvalidJson";
    CGMinerStatusCode[CGMinerStatusCode["AscsetErr"] = 120] = "AscsetErr";
})(CGMinerStatusCode || (exports.CGMinerStatusCode = CGMinerStatusCode = {}));
var UpgradeErrCode;
(function (UpgradeErrCode) {
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_APIVER"] = 1] = "UPGRADE_ERR_APIVER";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_HEADER"] = 2] = "UPGRADE_ERR_HEADER";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_FILESIZE"] = 3] = "UPGRADE_ERR_FILESIZE";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_OFFSET"] = 4] = "UPGRADE_ERR_OFFSET";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_PAYLOAD"] = 5] = "UPGRADE_ERR_PAYLOAD";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_MALLOC"] = 6] = "UPGRADE_ERR_MALLOC";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_HARDWARE"] = 7] = "UPGRADE_ERR_HARDWARE";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_AUP"] = 8] = "UPGRADE_ERR_AUP";
    UpgradeErrCode[UpgradeErrCode["UPGRADE_ERR_UNKNOWN"] = 255] = "UPGRADE_ERR_UNKNOWN";
})(UpgradeErrCode || (exports.UpgradeErrCode = UpgradeErrCode = {}));
class CGMinerAPIResult {
    static KEY_STATUS = 'STATUS';
    static KEY_When = 'When';
    static KEY_Code = 'Code';
    static KEY_Msg = 'Msg';
    static KEY_Desc = 'Description';
    result;
    scanTimestamp;
    response;
    _responseDict = null;
    tryTimes;
    msg;
    constructor(result, scanTimestamp, response, tryTimes, msg) {
        this.result = result;
        this.scanTimestamp = scanTimestamp;
        this.tryTimes = tryTimes;
        this.msg = msg;
        if (Buffer.isBuffer(response)) {
            this.response = response.toString('utf-8');
            this._responseDict = null;
        }
        else if (typeof response === 'string') {
            this.response = response;
            this._responseDict = null;
        }
        else {
            this.response = JSON.stringify(response);
            this._responseDict = response;
        }
    }
    static errorResult(when, msg, code = 14) {
        const response = {
            STATUS: [
                {
                    STATUS: 'E',
                    When: when,
                    Code: (0, utils_1.str2int)(String(code), 14) ?? 14,
                    Msg: msg,
                },
            ],
            id: 1,
        };
        return new CGMinerAPIResult(true, Date.now() / 1000, response, 0, msg);
    }
    debugStr() {
        const msgPreview = this.msg.length < 300
            ? this.msg
            : `${this.msg.substring(0, 150)} ... ${this.msg.substring(this.msg.length - 150)}`;
        return `${this.result} ${this.scanTimestamp} ${this.response} ${msgPreview}`;
    }
    responseDict() {
        if (this._responseDict !== null) {
            return this._responseDict;
        }
        if (this.result && this.response.length > 0) {
            try {
                this._responseDict = JSON.parse(this.response);
            }
            catch (e) {
                const errorStr = String(e);
                let sidx = 0;
                let eidx = 100;
                const peekLen = 50;
                const matched1 = errorStr.match(/.*\(\s*char\s+(\d+)\s*-\s*(\d+)\s*\).*/);
                if (matched1) {
                    sidx = Math.min(Math.max(((0, utils_1.str2int)(matched1[1]) ?? 0) - peekLen, 0), this.response.length);
                    eidx = Math.min(Math.max(((0, utils_1.str2int)(matched1[2]) ?? 0) + peekLen, sidx), this.response.length);
                }
                else {
                    const matched2 = errorStr.match(/.*\(\s*char\s+(\d+).*/);
                    if (matched2) {
                        sidx = Math.min(Math.max(((0, utils_1.str2int)(matched2[1]) ?? 0) - peekLen, 0), this.response.length);
                        eidx = Math.min(sidx + 2 * peekLen, this.response.length);
                    }
                }
                console.error(`load api response failed. ${sidx}:${eidx} <<<${this.response.substring(sidx, eidx)}>>>`);
            }
        }
        if (this._responseDict === null) {
            this._responseDict = {};
        }
        return this._responseDict;
    }
    responseStr() {
        return this.response;
    }
    statusDict() {
        const rd = this.responseDict();
        if (rd && CGMinerAPIResult.KEY_STATUS in rd) {
            const statusArray = rd[CGMinerAPIResult.KEY_STATUS];
            if (Array.isArray(statusArray) && statusArray.length > 0) {
                return statusArray[0];
            }
        }
        return null;
    }
    isRequestSuccess() {
        if (this.result) {
            const status = this.status();
            return status === CGMinerStatus.Success || status === CGMinerStatus.Informational;
        }
        return false;
    }
    status() {
        const statusDict = this.statusDict();
        if (statusDict) {
            try {
                return statusDict.STATUS;
            }
            catch {
                return CGMinerStatus.Fatal;
            }
        }
        const responseDict = this.responseDict();
        if (typeof responseDict === 'object' && Object.keys(responseDict).length > 0) {
            return CGMinerStatus.Success;
        }
        else {
            return CGMinerStatus.Fatal;
        }
    }
    when() {
        const statusDict = this.statusDict();
        if (statusDict) {
            return (0, utils_1.str2float)(String(statusDict[CGMinerAPIResult.KEY_When]), null);
        }
        return null;
    }
    statusMsg() {
        const statusDict = this.statusDict();
        return statusDict?.[CGMinerAPIResult.KEY_Msg];
    }
    statusCode() {
        const statusDict = this.statusDict();
        return statusDict?.[CGMinerAPIResult.KEY_Code];
    }
    successResponseDict(payloadKey) {
        if (this.isRequestSuccess()) {
            const responseDict = this.responseDict();
            if (payloadKey in responseDict) {
                return responseDict[payloadKey];
            }
        }
        return null;
    }
    stats() {
        return this.successResponseDict('STATS');
    }
    summary() {
        return this.successResponseDict('SUMMARY');
    }
    devs() {
        return this.successResponseDict('DEVS');
    }
    pools() {
        return this.successResponseDict('POOLS');
    }
    debug() {
        return this.successResponseDict('DEBUG');
    }
    minerupgrade() {
        return this.successResponseDict('MINERUPGRADE');
    }
    version() {
        return this.successResponseDict('VERSION');
    }
    mm3SoftwareVersion() {
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
    mm3UpgradeApiVersion() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            const versionObj = versionList[0];
            if ('UPAPI' in versionObj) {
                return (0, utils_1.str2int)(String(versionObj.UPAPI), 1) ?? 1;
            }
            const ver = this.mm3SoftwareVersion();
            if (ver === '19062002_1e9d1b0_61887c8' || ver === '19062001_d9eaa2c_c0487dd') {
                return 2;
            }
            return 1;
        }
        return 1;
    }
    mm3Mac() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].MAC;
        }
        return undefined;
    }
    mm3Dna() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].DNA;
        }
        return undefined;
    }
    mm3ProductName() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].PROD;
        }
        return undefined;
    }
    mm3Model() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].MODEL;
        }
        return undefined;
    }
    mm3HardwareType() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].HWTYPE;
        }
        return undefined;
    }
    mm3SoftwareType() {
        const versionList = this.version();
        if (versionList && Array.isArray(versionList) && versionList.length > 0) {
            return versionList[0].SWTYPE;
        }
        return undefined;
    }
}
exports.CGMinerAPIResult = CGMinerAPIResult;
function requestCgminerApiBySock(ip, command, parameters, options = {}) {
    // Note: Synchronous version is not fully implemented in Node.js
    // For full async support, use aioRequestCgminerApiBySock
    throw new Error('Synchronous version not fully implemented. Use aioRequestCgminerApiBySock instead.');
}
// Simplified synchronous version - for full async version, see async implementation below
async function aioRequestCgminerApiBySock(ip, command, parameters, options = {}) {
    const { port = exports.kDefaultPort, firstTimeout = 2, retry = 0, useJsonCommand = true, errorInfo, autoRetryIfRefusedConn = true, totalTimeout = 30 * 60, cancelEvent, } = options;
    if (cancelEvent?.aborted) {
        return canceledResult();
    }
    const totalStartTime = (0, utils_1.measurableTime)();
    const params = parameters || '';
    let totalTimeoutErr = false;
    let tryTimes = 0;
    const bufferLen = 8 * 1024;
    let bufferList = Buffer.alloc(0);
    const errMsgs = [];
    let success = false;
    let scantime = Date.now() / 1000;
    let unlimitedRetryCount = 0;
    const apiRequestId = (0, utils_1.randomStrOnlyWithAlnum)();
    while (!success && !totalTimeoutErr && tryTimes <= retry + unlimitedRetryCount) {
        if (cancelEvent?.aborted) {
            return canceledResult();
        }
        if ((0, utils_1.measurableTime)() > totalStartTime + totalTimeout) {
            totalTimeoutErr = true;
            errMsgs.push('total timeout');
            break;
        }
        const startTime = Date.now() / 1000;
        if (!suppressLedCommandLog || params.indexOf(',led,') < 0) {
            console.debug(`[${apiRequestId}] [${(0, utils_1.nowExactStr)()}] [ip ${ip} port ${port}] start command ${command} with parameter ${params.substring(0, 60)}`);
        }
        const timeout = Math.min(tryTimes + firstTimeout, Math.max(0.1, startTime + totalTimeout - Date.now() / 1000));
        tryTimes += 1;
        let connectSuccess = false;
        try {
            const socket = await new Promise((resolve, reject) => {
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
            if ((0, utils_1.measurableTime)() > totalStartTime + totalTimeout) {
                totalTimeoutErr = true;
                throw new Error('total timeout');
            }
            const chunks = [];
            let receivedData;
            while (true) {
                receivedData = await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        reject(new Error('Read timeout'));
                    }, timeout * 1000);
                    socket.once('data', (data) => {
                        clearTimeout(timeoutId);
                        resolve(data);
                    });
                    socket.once('error', (err) => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });
                });
                if (receivedData.length === 0)
                    break;
                chunks.push(receivedData);
                if ((0, utils_1.measurableTime)() > totalStartTime + totalTimeout) {
                    totalTimeoutErr = true;
                    throw new Error('total timeout');
                }
            }
            bufferList = Buffer.concat(chunks);
            success = true;
            socket.destroy();
        }
        catch (e) {
            const exceptErr = {};
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
                    if (errorInfo &&
                        errorInfo.length >= 2 &&
                        errorInfo[errorInfo.length - 2]?.socket_error_no === e.errno) {
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
                console.error(`[${apiRequestId}] [ip ${ip} port ${port}] exception when run command ${command} with parameter ${params.substring(0, 60)}. err: ${e}`);
            }
        }
        if (!success && !cancelEvent?.aborted) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    const deltaTotalTime = (0, utils_1.measurableTime)() - totalStartTime;
    let response = '';
    if (success) {
        response = bufferList;
        console.info(`[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: success. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}`);
    }
    else if (totalTimeoutErr) {
        console.info(`[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: total timeout. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}`);
        errMsgs.push(`Total timeout. limit ${totalTimeout}, real ${deltaTotalTime}`);
    }
    else {
        console.info(`[${apiRequestId}] [ip ${ip} port ${port}] [${tryTimes}/${retry}] api finish: other error. command ${command} with parameter ${params.substring(0, 60)}. dt: ${deltaTotalTime}. err: ${errMsgs[errMsgs.length - 1]?.substring(0, 100) || 'no err msg'}`);
    }
    return new CGMinerAPIResult(success, scantime, response, tryTimes, errMsgs.join('\n'));
}
function canceledResult() {
    return CGMinerAPIResult.errorResult(Date.now() / 1000, 'has been canceled', CGMinerStatusCode.Cancelled);
}
class CGMinerAPI {
    static defaultFirstTimeout = 5;
    static async multipleReportCommands(ip, cmdList, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, totalTimeout = 30 * 60) {
        const mulCmdR = await aioRequestCgminerApiBySock(ip, cmdList.join('+'), '', {
            port,
            firstTimeout,
            retry,
            totalTimeout,
        });
        return CGMinerAPI.splitMultipleReportApiResult(cmdList, mulCmdR);
    }
    static async aioMultipleReportCommands(ip, cmdList, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, totalTimeout = 30 * 60) {
        const mulCmdR = await aioRequestCgminerApiBySock(ip, cmdList.join('+'), '', {
            port,
            firstTimeout,
            retry,
            totalTimeout,
        });
        return CGMinerAPI.splitMultipleReportApiResult(cmdList, mulCmdR);
    }
    static splitMultipleReportApiResult(cmdList, mulCmdR) {
        const isSuccess = mulCmdR.isRequestSuccess();
        const allApiResults = { result: isSuccess };
        if (isSuccess) {
            for (const cmd of cmdList) {
                const cmdData = mulCmdR.successResponseDict(cmd);
                allApiResults[cmd] = new CGMinerAPIResult(mulCmdR.result, mulCmdR.scanTimestamp, Array.isArray(cmdData) && cmdData.length > 0 ? cmdData[0] : cmdData, mulCmdR.tryTimes, mulCmdR.msg);
            }
        }
        else {
            allApiResults['raw'] = mulCmdR;
        }
        return allApiResults;
    }
    static async estats(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'estats', '', { port, firstTimeout, retry });
    }
    static async edevs(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'edevs', '', { port, firstTimeout, retry });
    }
    static async summary(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'summary', '', { port, firstTimeout, retry });
    }
    static async pools(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'pools', '', { port, firstTimeout, retry });
    }
    static async toggleLED(ip, devId, modId, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `${devId},led,${modId}`, {
            port,
            firstTimeout,
            retry,
        });
    }
    static async turnLED(ip, devId, modId, turnOn, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `${devId},led,${modId}-${turnOn ? 1 : 0}`, { port, firstTimeout, retry });
    }
    static async queryA10LED(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        const response = await aioRequestCgminerApiBySock(ip, 'ascset', '0,led,0-255', {
            port,
            firstTimeout,
            retry,
            errorInfo,
        });
        if (response.result) {
            const msg = response.statusMsg();
            if (msg) {
                const parsed = (0, utils_1.parseCgminerBracketFormatStrIntoJson)(msg);
                return parsed['LED'] === 1;
            }
        }
        return null;
    }
    static async toggleDebug(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'debug', 'd', { port, firstTimeout, retry });
    }
    static async getDebugStatus(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'debug', '', { port, firstTimeout, retry });
    }
    static async turnOnDebug(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        const debugResult = await CGMinerAPI.getDebugStatus(ip, port, firstTimeout, retry);
        if (debugResult.isRequestSuccess()) {
            const debugData = debugResult.debug();
            if (Array.isArray(debugData) && debugData.length > 0 && !debugData[0].Debug) {
                await CGMinerAPI.toggleDebug(ip, port, firstTimeout, retry);
            }
            return true;
        }
        else {
            return false;
        }
    }
    static async reboot(ip, devId, modId, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `${devId},reboot,${modId}`, {
            port,
            firstTimeout,
            retry,
        });
    }
    static async rebootMm3(ip, lastWhen = 0, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `0,reboot,${lastWhen}`, {
            port,
            firstTimeout,
            retry,
            errorInfo,
        });
    }
    static async aioRebootMm3(ip, lastWhen = 0, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `0,reboot,${lastWhen}`, {
            port,
            firstTimeout,
            retry,
            errorInfo,
        });
    }
    static async mm3SetWorkmode(ip, workmode, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        return await aioRequestCgminerApiBySock(ip, 'ascset', `0,workmode,${workmode}`, {
            port,
            firstTimeout,
            retry,
            errorInfo,
        });
    }
    static async version(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        return await aioRequestCgminerApiBySock(ip, 'version', '', { port, firstTimeout, retry, errorInfo });
    }
    static async aioVersion(ip, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, errorInfo) {
        return await aioRequestCgminerApiBySock(ip, 'version', '', {
            port,
            firstTimeout,
            retry,
            errorInfo,
        });
    }
    static async mm3Upgrade(ip, uid, apiVersion, version, fileSize, offset, payloadLen, payload, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, useJsonCommand = true) {
        const paramStr = CGMinerAPI._prepareUpgradeParam(apiVersion, fileSize, ip, offset, payload, payloadLen, uid, version);
        return await aioRequestCgminerApiBySock(ip, 'ascset', '0,upgrade,' + paramStr, {
            port,
            firstTimeout,
            retry,
        });
    }
    static async aioMm3Upgrade(ip, uid, apiVersion, version, fileSize, offset, payloadLen, payload, port = exports.kDefaultPort, firstTimeout = CGMinerAPI.defaultFirstTimeout, retry = 0, useJsonCommand = true) {
        const paramStr = CGMinerAPI._prepareUpgradeParam(apiVersion, fileSize, ip, offset, payload, payloadLen, uid, version);
        return await aioRequestCgminerApiBySock(ip, 'ascset', '0,upgrade,' + paramStr, {
            port,
            firstTimeout,
            retry,
        });
    }
    static _prepareUpgradeParam(apiVersion, fileSize, ip, offset, payload, payloadLen, uid, version) {
        const endianness = 'little';
        const param = [];
        const endianFlag = 0b0; // 0 for little endian, 1 for big endian
        const apiVer = apiVersion;
        const byte0 = (endianFlag << 7) | apiVer;
        param.push((0, utils_1.longToBytes)(byte0, 1, endianness));
        const headerLen = 30; // header bytes count
        param.push((0, utils_1.longToBytes)(headerLen, 1, endianness));
        const cmdId = Math.floor(Math.random() * (65536 / 2)) + 1; // 2 bytes
        param.push((0, utils_1.longToBytes)(cmdId, 2, endianness));
        const subCmd = 0x0; // always 0
        param.push((0, utils_1.longToBytes)(subCmd, 1, endianness));
        const reserved1 = 0x0; // 3 bytes
        param.push((0, utils_1.longToBytes)(reserved1, 3, endianness));
        param.push((0, utils_1.longToBytes)(uid, 4, endianness));
        const versionBytes = version.substring(0, 8).padEnd(8, '\0');
        param.push((0, utils_1.toBytes)(versionBytes));
        param.push((0, utils_1.longToBytes)(fileSize, 4, endianness));
        param.push((0, utils_1.longToBytes)(offset, 4, endianness));
        param.push((0, utils_1.longToBytes)(payloadLen, 2, endianness));
        const reserved2 = 0x0; // 2 bytes
        param.push((0, utils_1.longToBytes)(reserved2, 2, endianness));
        param.push(payload);
        const combined = Buffer.concat(param);
        return Array.from(combined)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
exports.CGMinerAPI = CGMinerAPI;
//# sourceMappingURL=cg-miner-api.js.map