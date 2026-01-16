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

import * as fs from 'fs';
import { toStr, validateFilePath } from './utils';

export interface AupHeaderData {
  payloadLen?: number;
  firmwareVer?: string;
  payloadCrc?: number;
  headerLen?: number;
  hwList?: CommaSeparatedStrList | Fixed32Str[];
  hwListCount?: number;
  swList?: Fixed32Str[];
  swListCount?: number;
}

export interface CommaSeparatedStrList {
  hwStrList: string[];
}

export interface Fixed32Str {
  strValue: string;
}

export class AupHeader {
  magic: string;
  fmtVer: number;
  headerData: AupHeaderData;

  constructor(magic: string, fmtVer: number, headerData: AupHeaderData) {
    this.magic = magic;
    this.fmtVer = fmtVer;
    this.headerData = headerData;
  }

  static fromFile(filePath: string): AupHeader {
    // Validate and resolve file path to prevent path traversal attacks
    const validatedPath = validateFilePath(filePath);
    const buffer = fs.readFileSync(validatedPath);
    return AupHeader.fromBytes(buffer);
  }

  static fromBytes(buffer: Buffer): AupHeader {
    let offset = 0;

    // Read magic (16 bytes)
    const magic = buffer.subarray(offset, offset + 16).toString('utf-8').replace(/\0/g, '');
    offset += 16;

    // Read fmt_ver (4 bytes, little endian)
    const fmtVer = buffer.readUInt32LE(offset);
    offset += 4;

    let headerData: AupHeaderData = {};

    if (fmtVer === 0) {
      // Aup0
      headerData.payloadLen = buffer.readUInt32LE(offset);
      offset += 4;
      headerData.firmwareVer = buffer.subarray(offset, offset + 64).toString('utf-8').replace(/\0/g, '');
      offset += 64;
      headerData.payloadCrc = buffer.readUInt32LE(offset);
    } else if (fmtVer === 1) {
      // Aup1
      headerData.headerLen = buffer.readUInt32LE(offset);
      offset += 4;
      const hwListBytes = buffer.subarray(offset, offset + 128);
      offset += 128;
      headerData.hwList = AupHeader.parseCommaSeparatedStrList(hwListBytes);
      headerData.payloadLen = buffer.readUInt32LE(offset);
      offset += 4;
      headerData.firmwareVer = buffer.subarray(offset, offset + 64).toString('utf-8').replace(/\0/g, '');
      offset += 64;
      headerData.payloadCrc = buffer.readUInt32LE(offset);
    } else if (fmtVer === 2) {
      // Aup2
      headerData.payloadLen = buffer.readUInt32LE(offset);
      offset += 4;
      headerData.firmwareVer = buffer.subarray(offset, offset + 64).toString('utf-8').replace(/\0/g, '');
      offset += 64;
      headerData.payloadCrc = buffer.readUInt32LE(offset);
      offset += 4;
      headerData.hwListCount = buffer.readUInt32LE(offset);
      offset += 4;
      headerData.swListCount = buffer.readUInt32LE(offset);
      offset += 4;

      headerData.hwList = [];
      for (let i = 0; i < headerData.hwListCount!; i++) {
        const strBytes = buffer.subarray(offset, offset + 32);
        offset += 32;
        const strValue = AupHeader.bytesTerminate(strBytes, 0).toString('utf-8');
        headerData.hwList.push({ strValue });
      }

      headerData.swList = [];
      for (let i = 0; i < headerData.swListCount!; i++) {
        const strBytes = buffer.subarray(offset, offset + 32);
        offset += 32;
        const strValue = AupHeader.bytesTerminate(strBytes, 0).toString('utf-8');
        headerData.swList.push({ strValue });
      }
    }

    return new AupHeader(magic, fmtVer, headerData);
  }

  /**
   * Parse an AUP header from a readable stream.
   *
   * Note: This reads the entire stream into memory. That's fine for small AUP headers,
   * but callers should avoid passing a full multi-MB firmware stream unless intended.
   */
  static async fromStream(stream: fs.ReadStream): Promise<AupHeader> {
    const chunks: Buffer[] = [];
    return await new Promise<AupHeader>((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(AupHeader.fromBytes(buffer));
      });
      stream.on('error', reject);
    });
  }

  /**
   * Backward-compatible alias for stream parsing.
   * @deprecated Use AupHeader.fromStream(stream)
   */
  static async fromIo(stream: fs.ReadStream): Promise<AupHeader> {
    return await AupHeader.fromStream(stream);
  }

  private static parseCommaSeparatedStrList(buffer: Buffer): CommaSeparatedStrList {
    const hwStrList: string[] = [];
    let currentStr = '';
    let i = 0;

    while (i < buffer.length) {
      const byte = buffer[i];
      if (byte === 44) {
        // comma
        if (currentStr.length > 0) {
          hwStrList.push(currentStr);
          currentStr = '';
        }
      } else if (byte !== 0) {
        currentStr += String.fromCharCode(byte);
      }
      i++;
    }

    if (currentStr.length > 0) {
      hwStrList.push(currentStr);
    }

    return { hwStrList };
  }

  private static bytesTerminate(buffer: Buffer, terminator: number): Buffer {
    const index = buffer.indexOf(terminator);
    if (index === -1) {
      return buffer;
    }
    return buffer.subarray(0, index);
  }
}
