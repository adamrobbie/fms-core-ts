import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AupHeader } from '../src/aup-parser';

function buildAup0HeaderBuffer(): Buffer {
  const buf = Buffer.alloc(92, 0);
  Buffer.from('AUP format', 'utf-8').copy(buf, 0); // magic padded to 16 bytes
  buf.writeUInt32LE(0, 16); // fmtVer
  buf.writeUInt32LE(123456, 20); // payloadLen
  Buffer.from('19111502_test_abcdef', 'utf-8').copy(buf, 24); // firmwareVer (64 bytes)
  buf.writeUInt32LE(0xdeadbeef >>> 0, 88); // payloadCrc
  return buf;
}

describe('AupHeader stream parsing', () => {
  it('parses fromStream equivalently to fromBytes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fms-core-aup-'));
    const filePath = path.join(tmpDir, 'header.aup');

    const headerBytes = buildAup0HeaderBuffer();
    fs.writeFileSync(filePath, headerBytes);

    const expected = AupHeader.fromBytes(headerBytes);
    const stream = fs.createReadStream(filePath);
    const parsed = await AupHeader.fromStream(stream);

    expect(parsed.magic).toBe(expected.magic);
    expect(parsed.fmtVer).toBe(0);
    expect(parsed.headerData.payloadLen).toBe(123456);
    expect(parsed.headerData.payloadCrc).toBe(0xdeadbeef >>> 0);
    expect(parsed.headerData.firmwareVer).toContain('19111502_test');
  });

  it('fromIo is an async alias (deprecated) that still works', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fms-core-aup-'));
    const filePath = path.join(tmpDir, 'header.aup');

    const headerBytes = buildAup0HeaderBuffer();
    fs.writeFileSync(filePath, headerBytes);

    const stream = fs.createReadStream(filePath);
    const parsed = await AupHeader.fromIo(stream);
    expect(parsed.fmtVer).toBe(0);
  });
});

