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
  firmwareDateStr,
  hasAnyNoneInIterable,
  longToBytes,
  str2int,
  str2float,
  str2bool,
  toStr,
  toBytes,
  parseCgminerBracketFormatStr,
  parseCgminerBracketFormatStrIntoJson,
  randomStrOnlyWithAlnum,
  VirtualListAdder,
} from '../src/utils';

describe('utils', () => {
  describe('firmwareDateStr', () => {
    it('should extract date from A9 format', () => {
      expect(firmwareDateStr('9211809-b150820')).toBe('1809');
      expect(firmwareDateStr('9211809')).toBe('1809');
    });

    it('should extract date from A10 format', () => {
      expect(firmwareDateStr('1066-xx-19111502_e1a9ab6_6d08130')).toBe('19111502');
    });

    it('should return empty string for null/undefined', () => {
      expect(firmwareDateStr(null)).toBe('');
      expect(firmwareDateStr(undefined)).toBe('');
    });
  });

  describe('hasAnyNoneInIterable', () => {
    it('should return true if any value is null or undefined', () => {
      expect(hasAnyNoneInIterable([1, 2, null, 3])).toBe(true);
      expect(hasAnyNoneInIterable([1, 2, undefined, 3])).toBe(true);
    });

    it('should return false if no null/undefined values', () => {
      expect(hasAnyNoneInIterable([1, 2, 3])).toBe(false);
      expect(hasAnyNoneInIterable([])).toBe(false);
    });
  });

  describe('longToBytes', () => {
    it('should convert number to bytes (big endian)', () => {
      const result = longToBytes(0x12345678, 4, 'big');
      expect(result.length).toBe(4);
      expect(result.readUInt32BE(0)).toBe(0x12345678);
    });

    it('should convert number to bytes (little endian)', () => {
      const result = longToBytes(0x12345678, 4, 'little');
      expect(result.length).toBe(4);
      expect(result.readUInt32LE(0)).toBe(0x12345678);
    });

    it('should pad to expected byte count', () => {
      const result = longToBytes(0x12, 4, 'big');
      expect(result.length).toBe(4);
    });
  });

  describe('str2int', () => {
    it('should convert string to integer', () => {
      expect(str2int('123', 0)).toBe(123);
      expect(str2int('456', null)).toBe(456);
    });

    it('should return default on invalid input', () => {
      expect(str2int('abc', 0)).toBe(0);
      expect(str2int('abc', null)).toBe(null);
      expect(str2int(null, 42)).toBe(42);
    });
  });

  describe('str2float', () => {
    it('should convert string to float', () => {
      expect(str2float('123.45', 0)).toBe(123.45);
      expect(str2float('456', null)).toBe(456);
    });

    it('should handle percentage strings', () => {
      expect(str2float('50%', 0)).toBe(0.5);
      expect(str2float('100%', 0)).toBe(1.0);
    });

    it('should return default on invalid input', () => {
      // When parsing fails, returns the default value
      expect(str2float('abc', 0)).toBe(0);
      expect(str2float('abc', null)).toBe(null);
      expect(str2float('abc', 42)).toBe(42);
    });
  });

  describe('str2bool', () => {
    it('should convert truthy strings to true', () => {
      // str2bool checks float first, then string match
      expect(str2bool('1', false)).toBe(true); // Parses as float 1 > 0
      expect(str2bool('true', false)).toBe(true); // Matches string 'true'
      expect(str2bool('True', false)).toBe(true);
      expect(str2bool('TRUE', false)).toBe(true);
      expect(str2bool('yes', false)).toBe(true);
    });

    it('should convert falsy strings to false', () => {
      expect(str2bool('false', true)).toBe(false);
      expect(str2bool('0', true)).toBe(false);
      expect(str2bool('', true)).toBe(false);
    });

    it('should return default for null/undefined', () => {
      expect(str2bool(null, true)).toBe(true);
      expect(str2bool(undefined, false)).toBe(false);
    });
  });

  describe('toStr', () => {
    it('should convert Buffer to string', () => {
      const buf = Buffer.from('hello', 'utf-8');
      expect(toStr(buf)).toBe('hello');
    });

    it('should return string as-is', () => {
      expect(toStr('hello')).toBe('hello');
    });

    it('should convert other types to string', () => {
      expect(toStr(String(123))).toBe('123');
    });
  });

  describe('toBytes', () => {
    it('should convert string to Buffer', () => {
      const result = toBytes('hello');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf-8')).toBe('hello');
    });

    it('should return Buffer as-is', () => {
      const buf = Buffer.from('hello');
      expect(toBytes(buf)).toBe(buf);
    });
  });

  describe('parseCgminerBracketFormatStr', () => {
    it('should parse bracket format string', () => {
      const result = parseCgminerBracketFormatStr('key1[value1] key2[value2]');
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should handle empty string', () => {
      expect(parseCgminerBracketFormatStr('')).toEqual({});
    });
  });

  describe('parseCgminerBracketFormatStrIntoJson', () => {
    it('should parse and convert values to numbers', () => {
      const result = parseCgminerBracketFormatStrIntoJson('key1[123] key2[456.78]');
      expect(result.key1).toBe(123);
      expect(result.key2).toBe(456.78);
    });

    it('should handle arrays', () => {
      const result = parseCgminerBracketFormatStrIntoJson('key[1 2 3]');
      expect(Array.isArray(result.key)).toBe(true);
      expect(result.key).toEqual([1, 2, 3]);
    });
  });

  describe('randomStrOnlyWithAlnum', () => {
    it('should generate random string of specified length', () => {
      const result = randomStrOnlyWithAlnum(10);
      expect(result.length).toBe(10);
      expect(result).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should generate different strings', () => {
      const str1 = randomStrOnlyWithAlnum(20);
      const str2 = randomStrOnlyWithAlnum(20);
      // Very unlikely to be the same
      expect(str1).not.toBe(str2);
    });
  });

  describe('VirtualListAdder', () => {
    it('should combine two lists', () => {
      const list1 = [1, 2, 3];
      const list2 = [4, 5, 6];
      const adder = new VirtualListAdder(list1, 0, 3, list2, 0, 3);
      expect(adder.length).toBe(6);
      expect(adder.get(0)).toBe(1);
      expect(adder.get(3)).toBe(4);
      expect(adder.get(5)).toBe(6);
    });

    it('should handle partial ranges', () => {
      const list1 = [1, 2, 3];
      const list2 = [4, 5, 6];
      const adder = new VirtualListAdder(list1, 1, 2, list2, 0, 2);
      expect(adder.length).toBe(4);
      expect(adder.get(0)).toBe(2);
      expect(adder.get(1)).toBe(3);
      expect(adder.get(2)).toBe(4);
    });
  });
});
