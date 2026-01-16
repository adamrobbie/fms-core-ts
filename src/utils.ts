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
 * Utility functions for FMS core
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates an IPv4 address format
 * @param ip IP address string to validate
 * @returns true if valid IPv4 format, false otherwise
 */
export function validateIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255;
  });
}

/**
 * Validates a port number
 * @param port Port number to validate
 * @returns true if valid port (1-65535), false otherwise
 */
export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validates and resolves a file path, preventing path traversal attacks
 * @param filePath File path to validate
 * @param baseDir Base directory (defaults to current working directory)
 * @returns Resolved absolute path
 * @throws Error if path traversal detected or path is invalid
 */
export function validateFilePath(filePath: string, baseDir?: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }
  
  const base = path.resolve(baseDir || process.cwd());
  const resolved = path.resolve(base, filePath);
  
  // Check for path traversal
  if (!resolved.startsWith(base)) {
    throw new Error('Path traversal detected: path outside base directory');
  }
  
  // Check if file exists and is not a symlink
  try {
    const stats = fs.lstatSync(resolved);
    if (stats.isSymbolicLink()) {
      throw new Error('Symlinks not allowed for security reasons');
    }
    if (!stats.isFile()) {
      throw new Error('Path does not point to a file');
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist yet - that's okay for some operations
      // But still validate the directory path
      const dirPath = path.dirname(resolved);
      try {
        const dirStats = fs.lstatSync(dirPath);
        if (dirStats.isSymbolicLink()) {
          throw new Error('Symlinks not allowed for security reasons');
        }
      } catch (dirErr) {
        throw new Error(`Invalid directory path: ${(dirErr as Error).message}`);
      }
    } else {
      throw err;
    }
  }
  
  return resolved;
}

/**
 * Gets a safe filename for logging (basename only, no path)
 * @param filePath Full file path
 * @returns Safe filename for logging
 */
export function safeFilenameForLog(filePath: string): string {
  if (!filePath) return '<unknown>';
  return path.basename(filePath);
}

/**
 * Generates a cryptographically secure random string using alphanumeric characters
 * @param n Length of the random string (default: 6)
 * @returns Random alphanumeric string
 */
export function randomStrOnlyWithAlnumSecure(n: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Generates a cryptographically secure random integer in a range
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns Random integer in range [min, max)
 */
export function secureRandomInt(min: number, max: number): number {
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  return min + (randomValue % range);
}

export function firmwareDateStr(ver: string | null | undefined): string {
  if (!ver) return ver || '';
  const parts = ver.trim().split('-');
  if (parts[0].length === 7) {
    // A9 and before have ver like 9211809-b150820
    return ver[3].match(/\d/) ? parts[0].substring(3) : parts[0].substring(4);
  } else {
    // A10 like 1066-xx-19111502_e1a9ab6_6d08130
    const verPartsWithoutMinerType = parts[parts.length - 1].split('_');
    if (verPartsWithoutMinerType.length >= 3) {
      return verPartsWithoutMinerType[0];
    }
    return ver;
  }
}

export function hasAnyNoneInIterable<T>(iterable: (T | null | undefined)[]): boolean {
  return iterable.some(v => v === null || v === undefined);
}

export function longToBytes(
  val: number,
  expectByteCount?: number,
  endianness: 'big' | 'little' = 'big'
): Buffer {
  let width = Math.ceil(Math.log2(val + 1));
  width += 8 - ((width % 8) || 8);
  
  if (expectByteCount !== undefined && expectByteCount > width / 8) {
    width = expectByteCount * 8;
  }

  const byteCount = width / 8;
  const buffer = Buffer.allocUnsafe(byteCount);
  
  if (endianness === 'big') {
    buffer.writeUIntBE(val, 0, byteCount);
  } else {
    buffer.writeUIntLE(val, 0, byteCount);
  }
  
  return buffer;
}

export function measurableTime(): number {
  return performance.now() / 1000; // Convert to seconds
}

export function nowExactStr(): string {
  return new Date().toISOString();
}

export function parseCgminerBracketFormatStr(bs: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /\s*([^ \[\]]+)\[([^\[\]]+)\]\s*/g;
  let match;
  
  while ((match = regex.exec(bs)) !== null) {
    if (match.length >= 3) {
      result[match[1]] = match[2];
    }
  }
  
  return result;
}

export function parseCgminerBracketFormatStrIntoJson(bs: string): Record<string, any> {
  const r = parseCgminerBracketFormatStr(bs);
  const newValues: Record<string, any> = {};
  
  for (const [k, v] of Object.entries(r)) {
    const stripedV = v.trim();
    const items = stripedV.split(/\s+/);
    
    if (items.length === 1) {
      const floatV = str2float(stripedV, null);
      if (floatV !== null && !isFinite(floatV)) {
        const intV = Math.floor(floatV);
        newValues[k] = intV === floatV ? intV : floatV;
      } else if (floatV !== null) {
        const intV = Math.floor(floatV);
        newValues[k] = intV === floatV ? intV : floatV;
      }
    } else {
      const floatItems = items.map(item => str2float(item));
      if (!hasAnyNoneInIterable(floatItems)) {
        const intItems = floatItems
          .filter(fv => fv !== null && isFinite(fv!) && Math.floor(fv!) === fv!)
          .map(fv => Math.floor(fv!));
        newValues[k] = intItems.length === floatItems.length ? intItems : floatItems;
      }
    }
  }
  
  return { ...r, ...newValues };
}

/**
 * @deprecated Use randomStrOnlyWithAlnumSecure() for cryptographically secure random strings
 * This function uses Math.random() which is not cryptographically secure
 */
export function randomStrOnlyWithAlnum(n: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < n; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function str2primitive<T>(s: string, t: (val: string) => T, defaultVal: T): T {
  try {
    const result = t(s);
    // Handle NaN for number types
    if (typeof result === 'number' && isNaN(result)) {
      return defaultVal;
    }
    return result;
  } catch {
    return defaultVal;
  }
}

export function str2int(s: string | null | undefined, defaultVal: number | null = 0): number | null {
  if (s === null || s === undefined) return defaultVal;
  return str2primitive(s, parseInt, defaultVal);
}

export function str2float(s: string | number | null | undefined, defaultVal: number | null = 0.0): number | null {
  if (s === null || s === undefined) return defaultVal;
  
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

export function str2bool(s: string | null | undefined, defaultVal: boolean = false): boolean {
  if (s === null || s === undefined) return defaultVal;
  
  const f = str2float(s, null);
  if (f !== null && !isNaN(f)) {
    return f > 0;
  }
  
  const str = String(s).toLowerCase();
  return ['true', '1', 't', 'y', 'yes', 'yeah', 'yup', 'certainly', 'uh-huh'].includes(str);
}

export function toStr(bytesOrStr: string | Buffer | Uint8Array): string {
  if (typeof bytesOrStr === 'string') {
    return bytesOrStr;
  } else if (Buffer.isBuffer(bytesOrStr) || bytesOrStr instanceof Uint8Array) {
    return Buffer.from(bytesOrStr).toString('utf-8');
  } else {
    return String(bytesOrStr);
  }
}

export function toBytes(bytesOrStr: string | Buffer | Uint8Array): Buffer {
  if (typeof bytesOrStr === 'string') {
    return Buffer.from(bytesOrStr, 'utf-8');
  } else if (Buffer.isBuffer(bytesOrStr)) {
    return bytesOrStr;
  } else if (bytesOrStr instanceof Uint8Array) {
    return Buffer.from(bytesOrStr);
  } else {
    return Buffer.from(String(bytesOrStr), 'utf-8');
  }
}

export class VirtualListAdder<T> {
  private list1: T[];
  private list1StartIdx: number;
  private list1RangeLen: number;
  private list2: T[];
  private list2StartIdx: number;
  private list2RangeLen: number;

  constructor(
    list1: T[],
    list1StartIdx?: number,
    list1RangeLen?: number,
    list2?: T[],
    list2StartIdx?: number,
    list2RangeLen?: number
  ) {
    this.list1 = list1 || [];
    this.list1StartIdx = list1StartIdx ?? 0;
    this.list1RangeLen = list1RangeLen ?? (this.list1.length - this.list1StartIdx);
    this.list2 = list2 || this.list1.slice(0, 0);
    this.list2StartIdx = list2StartIdx ?? 0;
    this.list2RangeLen = list2RangeLen ?? (this.list2.length - this.list2StartIdx);
  }

  get length(): number {
    return this.list1RangeLen + this.list2RangeLen;
  }

  get(index: number): T {
    const r = this.rangeValues(index, 1);
    return r.length > 0 ? r[0] : this.empty()[0];
  }

  slice(start?: number, end?: number, step: number = 1): T[] {
    const len = this.length;
    const s = start ?? 0;
    const e = end ?? len;
    
    if (s >= e && step > 0) return this.empty();
    if (s < e && step < 0) return this.empty();
    
    const result = this.rangeValues(s, e - s);
    return step === 1 ? result : result.filter((_, i) => i % step === 0);
  }

  private empty(): T[] {
    return this.list1.slice(0, 0);
  }

  private rangeValues(startIdx: number, count: number): T[] {
    if (startIdx + count <= this.list1RangeLen) {
      const headerCurIdx = startIdx + this.list1StartIdx;
      return this.list1.slice(headerCurIdx, headerCurIdx + count);
    } else if (startIdx < this.list1RangeLen) {
      const headerCurIdx = startIdx + this.list1StartIdx;
      const result = this.list1.slice(headerCurIdx, this.list1StartIdx + this.list1RangeLen);
      const lenInImg = count - (this.list1RangeLen - startIdx);
      const endIdx = Math.min(
        this.list2StartIdx + lenInImg,
        this.list2StartIdx + this.list2RangeLen
      );
      return result.concat(this.list2.slice(this.list2StartIdx, endIdx));
    } else {
      const imgStartIdx = this.list2StartIdx + startIdx - this.list1RangeLen;
      const endIdx = Math.min(
        imgStartIdx + count,
        this.list2StartIdx + this.list2RangeLen
      );
      return this.list2.slice(imgStartIdx, endIdx);
    }
  }
}
