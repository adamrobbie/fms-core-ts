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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualListAdder = void 0;
exports.firmwareDateStr = firmwareDateStr;
exports.hasAnyNoneInIterable = hasAnyNoneInIterable;
exports.longToBytes = longToBytes;
exports.measurableTime = measurableTime;
exports.nowExactStr = nowExactStr;
exports.parseCgminerBracketFormatStr = parseCgminerBracketFormatStr;
exports.parseCgminerBracketFormatStrIntoJson = parseCgminerBracketFormatStrIntoJson;
exports.randomStrOnlyWithAlnum = randomStrOnlyWithAlnum;
exports.str2primitive = str2primitive;
exports.str2int = str2int;
exports.str2float = str2float;
exports.str2bool = str2bool;
exports.toStr = toStr;
exports.toBytes = toBytes;
/**
 * Utility functions for FMS core
 */
function firmwareDateStr(ver) {
    if (!ver)
        return ver || '';
    const parts = ver.trim().split('-');
    if (parts[0].length === 7) {
        // A9 and before have ver like 9211809-b150820
        return ver[3].match(/\d/) ? parts[0].substring(3) : parts[0].substring(4);
    }
    else {
        // A10 like 1066-xx-19111502_e1a9ab6_6d08130
        const verPartsWithoutMinerType = parts[parts.length - 1].split('_');
        if (verPartsWithoutMinerType.length >= 3) {
            return verPartsWithoutMinerType[0];
        }
        return ver;
    }
}
function hasAnyNoneInIterable(iterable) {
    return iterable.some(v => v === null || v === undefined);
}
function longToBytes(val, expectByteCount, endianness = 'big') {
    let width = Math.ceil(Math.log2(val + 1));
    width += 8 - ((width % 8) || 8);
    if (expectByteCount !== undefined && expectByteCount > width / 8) {
        width = expectByteCount * 8;
    }
    const byteCount = width / 8;
    const buffer = Buffer.allocUnsafe(byteCount);
    if (endianness === 'big') {
        buffer.writeUIntBE(val, 0, byteCount);
    }
    else {
        buffer.writeUIntLE(val, 0, byteCount);
    }
    return buffer;
}
function measurableTime() {
    return performance.now() / 1000; // Convert to seconds
}
function nowExactStr() {
    return new Date().toISOString();
}
function parseCgminerBracketFormatStr(bs) {
    const result = {};
    const regex = /\s*([^ \[\]]+)\[([^\[\]]+)\]\s*/g;
    let match;
    while ((match = regex.exec(bs)) !== null) {
        if (match.length >= 3) {
            result[match[1]] = match[2];
        }
    }
    return result;
}
function parseCgminerBracketFormatStrIntoJson(bs) {
    const r = parseCgminerBracketFormatStr(bs);
    const newValues = {};
    for (const [k, v] of Object.entries(r)) {
        const stripedV = v.trim();
        const items = stripedV.split(/\s+/);
        if (items.length === 1) {
            const floatV = str2float(stripedV, null);
            if (floatV !== null && !isFinite(floatV)) {
                const intV = Math.floor(floatV);
                newValues[k] = intV === floatV ? intV : floatV;
            }
            else if (floatV !== null) {
                const intV = Math.floor(floatV);
                newValues[k] = intV === floatV ? intV : floatV;
            }
        }
        else {
            const floatItems = items.map(item => str2float(item));
            if (!hasAnyNoneInIterable(floatItems)) {
                const intItems = floatItems
                    .filter(fv => fv !== null && isFinite(fv) && Math.floor(fv) === fv)
                    .map(fv => Math.floor(fv));
                newValues[k] = intItems.length === floatItems.length ? intItems : floatItems;
            }
        }
    }
    return { ...r, ...newValues };
}
function randomStrOnlyWithAlnum(n = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < n; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
function str2primitive(s, t, defaultVal) {
    try {
        const result = t(s);
        // Handle NaN for number types
        if (typeof result === 'number' && isNaN(result)) {
            return defaultVal;
        }
        return result;
    }
    catch {
        return defaultVal;
    }
}
function str2int(s, defaultVal = 0) {
    if (s === null || s === undefined)
        return defaultVal;
    return str2primitive(s, parseInt, defaultVal);
}
function str2float(s, defaultVal = 0.0) {
    if (s === null || s === undefined)
        return defaultVal;
    if (typeof s === 'string') {
        let tmpS = s.trim();
        let scale = 1.0;
        if (tmpS.endsWith('%')) {
            scale = 0.01;
            tmpS = tmpS.slice(0, -1);
        }
        const f = str2primitive(tmpS, parseFloat, defaultVal);
        if (f !== null && f !== defaultVal && !isNaN(f)) {
            return f * scale;
        }
        // Return defaultVal if parsing resulted in NaN
        if (f !== null && isNaN(f)) {
            return defaultVal;
        }
        return f;
    }
    const result = str2primitive(String(s), parseFloat, defaultVal);
    if (result !== null && isNaN(result)) {
        return defaultVal;
    }
    return result;
}
function str2bool(s, defaultVal = false) {
    if (s === null || s === undefined)
        return defaultVal;
    const f = str2float(s, null);
    if (f !== null && !isNaN(f)) {
        return f > 0;
    }
    const str = String(s).toLowerCase();
    return ['true', '1', 't', 'y', 'yes', 'yeah', 'yup', 'certainly', 'uh-huh'].includes(str);
}
function toStr(bytesOrStr) {
    if (typeof bytesOrStr === 'string') {
        return bytesOrStr;
    }
    else if (Buffer.isBuffer(bytesOrStr) || bytesOrStr instanceof Uint8Array) {
        return Buffer.from(bytesOrStr).toString('utf-8');
    }
    else {
        return String(bytesOrStr);
    }
}
function toBytes(bytesOrStr) {
    if (typeof bytesOrStr === 'string') {
        return Buffer.from(bytesOrStr, 'utf-8');
    }
    else if (Buffer.isBuffer(bytesOrStr)) {
        return bytesOrStr;
    }
    else if (bytesOrStr instanceof Uint8Array) {
        return Buffer.from(bytesOrStr);
    }
    else {
        return Buffer.from(String(bytesOrStr), 'utf-8');
    }
}
class VirtualListAdder {
    list1;
    list1StartIdx;
    list1RangeLen;
    list2;
    list2StartIdx;
    list2RangeLen;
    constructor(list1, list1StartIdx, list1RangeLen, list2, list2StartIdx, list2RangeLen) {
        this.list1 = list1 || [];
        this.list1StartIdx = list1StartIdx ?? 0;
        this.list1RangeLen = list1RangeLen ?? (this.list1.length - this.list1StartIdx);
        this.list2 = list2 || this.list1.slice(0, 0);
        this.list2StartIdx = list2StartIdx ?? 0;
        this.list2RangeLen = list2RangeLen ?? (this.list2.length - this.list2StartIdx);
    }
    get length() {
        return this.list1RangeLen + this.list2RangeLen;
    }
    get(index) {
        const r = this.rangeValues(index, 1);
        return r.length > 0 ? r[0] : this.empty()[0];
    }
    slice(start, end, step = 1) {
        const len = this.length;
        const s = start ?? 0;
        const e = end ?? len;
        if (s >= e && step > 0)
            return this.empty();
        if (s < e && step < 0)
            return this.empty();
        const result = this.rangeValues(s, e - s);
        return step === 1 ? result : result.filter((_, i) => i % step === 0);
    }
    empty() {
        return this.list1.slice(0, 0);
    }
    rangeValues(startIdx, count) {
        if (startIdx + count <= this.list1RangeLen) {
            const headerCurIdx = startIdx + this.list1StartIdx;
            return this.list1.slice(headerCurIdx, headerCurIdx + count);
        }
        else if (startIdx < this.list1RangeLen) {
            const headerCurIdx = startIdx + this.list1StartIdx;
            const result = this.list1.slice(headerCurIdx, this.list1StartIdx + this.list1RangeLen);
            const lenInImg = count - (this.list1RangeLen - startIdx);
            const endIdx = Math.min(this.list2StartIdx + lenInImg, this.list2StartIdx + this.list2RangeLen);
            return result.concat(this.list2.slice(this.list2StartIdx, endIdx));
        }
        else {
            const imgStartIdx = this.list2StartIdx + startIdx - this.list1RangeLen;
            const endIdx = Math.min(imgStartIdx + count, this.list2StartIdx + this.list2RangeLen);
            return this.list2.slice(imgStartIdx, endIdx);
        }
    }
}
exports.VirtualListAdder = VirtualListAdder;
//# sourceMappingURL=utils.js.map