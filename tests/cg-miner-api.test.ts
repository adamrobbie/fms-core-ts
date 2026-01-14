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
  CGMinerAPIResult,
  CGMinerStatus,
  CGMinerStatusCode,
  UpgradeErrCode,
} from '../src/cg-miner-api';

describe('CGMinerAPIResult', () => {
  describe('errorResult', () => {
    it('should create error result', () => {
      const result = CGMinerAPIResult.errorResult(Date.now() / 1000, 'Test error', 14);
      expect(result.result).toBe(true);
      expect(result.msg).toBe('Test error');
      expect(result.status()).toBe(CGMinerStatus.Error);
    });
  });

  describe('responseDict', () => {
    it('should parse JSON response', () => {
      const jsonResponse = JSON.stringify({
        STATUS: [{ STATUS: 'S', When: 1234567890, Code: 0, Msg: 'Success' }],
        id: 1,
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      const dict = result.responseDict();
      expect(dict.STATUS).toBeDefined();
      expect(Array.isArray(dict.STATUS)).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = new CGMinerAPIResult(true, Date.now() / 1000, 'invalid json', 1, '');
      const dict = result.responseDict();
      expect(dict).toEqual({});
    });
  });

  describe('status', () => {
    it('should return status from response', () => {
      const jsonResponse = JSON.stringify({
        STATUS: [{ STATUS: 'S', When: 1234567890, Code: 0, Msg: 'Success' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.status()).toBe(CGMinerStatus.Success);
    });

    it('should return Fatal for empty response', () => {
      const result = new CGMinerAPIResult(false, Date.now() / 1000, '', 1, '');
      expect(result.status()).toBe(CGMinerStatus.Fatal);
    });
  });

  describe('isRequestSuccess', () => {
    it('should return true for success status', () => {
      const jsonResponse = JSON.stringify({
        STATUS: [{ STATUS: 'S', When: 1234567890, Code: 0, Msg: 'Success' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.isRequestSuccess()).toBe(true);
    });

    it('should return true for informational status', () => {
      const jsonResponse = JSON.stringify({
        STATUS: [{ STATUS: 'I', When: 1234567890, Code: 0, Msg: 'Info' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.isRequestSuccess()).toBe(true);
    });

    it('should return false for error status', () => {
      const jsonResponse = JSON.stringify({
        STATUS: [{ STATUS: 'E', When: 1234567890, Code: 1, Msg: 'Error' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.isRequestSuccess()).toBe(false);
    });
  });

  describe('mm3SoftwareVersion', () => {
    it('should extract software version', () => {
      const jsonResponse = JSON.stringify({
        VERSION: [{ VERSION: '19111502_e1a9ab6_6d08130' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.mm3SoftwareVersion()).toBe('19111502_e1a9ab6_6d08130');
    });

    it('should handle typo in firmware (VERION)', () => {
      const jsonResponse = JSON.stringify({
        VERSION: [{ VERION: '19111502_e1a9ab6_6d08130' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.mm3SoftwareVersion()).toBe('19111502_e1a9ab6_6d08130');
    });
  });

  describe('mm3UpgradeApiVersion', () => {
    it('should extract upgrade API version', () => {
      const jsonResponse = JSON.stringify({
        VERSION: [{ UPAPI: '2' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.mm3UpgradeApiVersion()).toBe(2);
    });

    it('should default to version 1 if UPAPI not present', () => {
      const jsonResponse = JSON.stringify({
        VERSION: [{ VERSION: '19111502_e1a9ab6_6d08130' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.mm3UpgradeApiVersion()).toBe(1);
    });

    it('should return version 2 for specific firmware versions', () => {
      const jsonResponse = JSON.stringify({
        VERSION: [{ VERSION: '19062002_1e9d1b0_61887c8' }],
      });
      const result = new CGMinerAPIResult(true, Date.now() / 1000, jsonResponse, 1, '');
      expect(result.mm3UpgradeApiVersion()).toBe(2);
    });
  });
});

describe('Enums', () => {
  it('should have correct CGMinerStatus values', () => {
    expect(CGMinerStatus.Warning).toBe('W');
    expect(CGMinerStatus.Success).toBe('S');
    expect(CGMinerStatus.Error).toBe('E');
  });

  it('should have correct CGMinerStatusCode values', () => {
    expect(CGMinerStatusCode.Cancelled).toBe(99999);
    expect(CGMinerStatusCode.InvalidJson).toBe(23);
    expect(CGMinerStatusCode.AscsetErr).toBe(120);
  });

  it('should have correct UpgradeErrCode values', () => {
    expect(UpgradeErrCode.UPGRADE_ERR_APIVER).toBe(1);
    expect(UpgradeErrCode.UPGRADE_ERR_HEADER).toBe(2);
    expect(UpgradeErrCode.UPGRADE_ERR_UNKNOWN).toBe(0xff);
  });
});
