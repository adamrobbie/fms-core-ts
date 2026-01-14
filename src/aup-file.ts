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
import { AupHeader } from './aup-parser';
import { toStr, toBytes, VirtualListAdder } from './utils';

// Simple CRC32 implementation
function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class AUPHeaderInfo {
  private _errMsgList: string[] = [];
  private _isLegal = false;
  parsedHeader: AupHeader | null = null;
  private _supportedHwtypeList: string[] = [];

  constructor(aupFile: string | Buffer | fs.ReadStream) {
    try {
      if (typeof aupFile === 'string') {
        const isFilePath = fs.existsSync(aupFile) && fs.statSync(aupFile).isFile();
        if (isFilePath) {
          this.parsedHeader = AupHeader.fromFile(aupFile);
        } else {
          this.parsedHeader = AupHeader.fromBytes(Buffer.from(aupFile));
        }
      } else if (Buffer.isBuffer(aupFile)) {
        this.parsedHeader = AupHeader.fromBytes(aupFile);
      } else {
        // For ReadStream, we'd need async handling - simplified for now
        throw new Error('ReadStream not fully supported in sync context');
      }

      if (this.parsedHeader === null) {
        throw new Error('AUP header parser init failed');
      }
    } catch (e: any) {
      console.error('AUPHeaderInfo init end with exception', e);
      this._isLegal = false;
      this._errMsgList.push(`${e.constructor.name}: ${e.message}`);
      return;
    }

    try {
      if (this.magic() !== 'AUP format') {
        this._errMsgList.push('illegal AUP file');
        return;
      }

      const fmtVer = this.parsedHeader!.fmtVer;
      if (fmtVer === null || fmtVer === undefined) {
        this._errMsgList.push('AUP file illegal: fmt ver');
        return;
      }

      const targetVer = this.firmwareVer();
      this._hackSupportedHwtypeList(targetVer);

      if (fmtVer === 1) {
        const hwList = this.parsedHeader!.headerData.hwList as any;
        if (hwList && 'hwStrList' in hwList) {
          this._supportedHwtypeList = hwList.hwStrList.map((hwtypeStr: string) =>
            toStr(hwtypeStr).replace(/\0/g, '').trim()
          );
        }
      }

      if (fmtVer === 2) {
        const hwList = this.parsedHeader!.headerData.hwList as Array<{ strValue: string }>;
        if (hwList) {
          this._supportedHwtypeList = hwList.map((hwItem) =>
            toStr(hwItem.strValue).replace(/\0/g, '').trim()
          );
        }
      }

      this._isLegal = true;
    } catch (e: any) {
      this._errMsgList.push('analyse_aup_file get exception');
      console.error(this.errMessage(), e);
    }
  }

  private _hackSupportedHwtypeList(targetVer: string): void {
    if (
      [
        '19092001_01ce5cf_789e6f2',
        '19101401_956c147_08bcf10',
        '19101201_fe411a8_71edeca',
        '19101501_f293f38_2fbfeda',
      ].includes(targetVer)
    ) {
      this._supportedHwtypeList.push('MM3v1_X3');
    }
  }

  isLegal(): boolean {
    return this._isLegal;
  }

  allSupportedHwtypeList(): string[] {
    return this._supportedHwtypeList;
  }

  errMessage(): string {
    return this._errMsgList.join(',');
  }

  firmwareVer(): string {
    return toStr(this.parsedHeader!.headerData.firmwareVer || '').replace(/\0/g, '').trim();
  }

  aupHeaderVer(): number {
    return this.parsedHeader!.fmtVer;
  }

  allSupportedSwtypeList(): string[] {
    if (this.isLegal() && this.parsedHeader!.headerData.swList) {
      return this.parsedHeader!.headerData.swList.map((swItem) =>
        toStr(swItem.strValue).replace(/\0/g, '').trim()
      );
    }
    return [];
  }

  totalLen(): number {
    const aupVer = this.aupHeaderVer();
    if (aupVer === 0) {
      return 92;
    } else if (aupVer === 1) {
      return 224;
    } else if (aupVer === 2) {
      return (
        100 +
        32 *
          ((this.parsedHeader!.headerData.hwListCount || 0) +
            (this.parsedHeader!.headerData.swListCount || 0)) +
        4
      );
    }
    return 0;
  }

  magic(): string {
    return toStr(this.parsedHeader!.magic).replace(/\0/g, '').trim();
  }

  payloadLen(): number {
    return this.parsedHeader!.headerData.payloadLen || 0;
  }

  payloadCrc(): number {
    return this.parsedHeader!.headerData.payloadCrc || 0;
  }

  hwListCount(): number {
    return this._supportedHwtypeList.length;
  }

  swListCount(): number {
    if (this.isLegal() && this.parsedHeader!.headerData.swList) {
      return this.parsedHeader!.headerData.swList.length;
    }
    return 0;
  }
}

export class AUPFile {
  filePath: string;
  rawPayload: Buffer;
  headerInfo: AUPHeaderInfo;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.rawPayload = fs.readFileSync(filePath);
    this.headerInfo = new AUPHeaderInfo(this.rawPayload);
  }

  header(): AUPHeaderInfo {
    return this.headerInfo;
  }

  is1066(): boolean {
    for (const hwtype of this.headerInfo.allSupportedHwtypeList()) {
      if (hwtype.startsWith('MM3v1_X3')) {
        return true;
      }
    }
    return false;
  }

  fileContentBinary(): Buffer {
    return this.rawPayload;
  }

  aupHeaderBinary(): Buffer {
    return this.rawPayload.subarray(0, this.headerInfo.totalLen());
  }

  generateAupHeaderPayload(targetAupVer: number): Buffer {
    if (!this.headerInfo.isLegal()) {
      return this.aupHeaderBinary();
    }

    if (targetAupVer === this.headerInfo.aupHeaderVer()) {
      return this.aupHeaderBinary();
    }

    if (targetAupVer === 0) {
      const magicBytes = toBytes(this.headerInfo.magic());
      const versionBytes = toBytes(this.headerInfo.firmwareVer().padEnd(64, '\0'));
      const buffer = Buffer.allocUnsafe(92);
      magicBytes.copy(buffer, 0);
      buffer.writeUInt32LE(0, 16); // fmt_ver
      buffer.writeUInt32LE(this.headerInfo.payloadLen(), 20);
      versionBytes.copy(buffer, 24);
      buffer.writeUInt32LE(this.headerInfo.payloadCrc(), 88);
      return buffer;
    } else if (targetAupVer === 2) {
      let hwList = this.headerInfo.allSupportedHwtypeList();
      if (hwList.length === 0) {
        hwList = ['MM3v1_X3'];
      }
      let swList = this.headerInfo.allSupportedSwtypeList();
      if (swList.length === 0) {
        swList = ['MM310'];
      }

      const fixedListItemLen = 32;
      const headerLen =
        100 + (hwList.length + swList.length) * fixedListItemLen + 4;
      const buffer = Buffer.allocUnsafe(headerLen);

      toBytes(this.headerInfo.magic()).copy(buffer, 0);
      buffer.writeUInt32LE(2, 16); // fmt_ver
      buffer.writeUInt32LE(this.headerInfo.payloadLen(), 20);
      toBytes(this.headerInfo.firmwareVer().padEnd(64, '\0')).copy(buffer, 24);
      buffer.writeUInt32LE(this.headerInfo.payloadCrc(), 88);
      buffer.writeUInt32LE(hwList.length, 92);
      buffer.writeUInt32LE(swList.length, 96);

      let offset = 100;
      for (const hw of hwList) {
        toBytes(hw.padEnd(fixedListItemLen, '\0')).copy(buffer, offset);
        offset += fixedListItemLen;
      }
      for (const sw of swList) {
        toBytes(sw.padEnd(fixedListItemLen, '\0')).copy(buffer, offset);
        offset += fixedListItemLen;
      }

      const beforeCrc = buffer.subarray(0, headerLen - 4);
      const crc = crc32(beforeCrc);
      buffer.writeUInt32LE(crc, headerLen - 4);

      return buffer;
    } else {
      return this.aupHeaderBinary();
    }
  }
}
