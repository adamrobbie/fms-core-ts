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

import { aioMm3Upgrade, UpgradeResults, UpgradeStatus, ProgressReportFunction } from './aio-upgrade';
import { AUPFile } from './aup-file';
import { printProgressBar } from './cli-progress-bar';

export async function upgradeFirmware(
  ip: string,
  port: number,
  firmwareFilePath: string,
  timeout: number = 12 * 60
): Promise<[boolean, UpgradeResults]> {
  const onProgress: ProgressReportFunction = (ratio, status) => {
    const ratioValue = typeof ratio === 'number' ? ratio : 1.0;
    printProgressBar(ratioValue, 1.0, String(status));
  };

  const aupFile = new AUPFile(firmwareFilePath);
  const aupFilePayload = aupFile.fileContentBinary();
  const version = aupFile.header().firmwareVer();

  return await aioMm3Upgrade(
    ip,
    port,
    0,
    version,
    aupFilePayload,
    888,
    timeout,
    true,
    onProgress,
    aupFile.header().allSupportedHwtypeList(),
    aupFile.header().allSupportedSwtypeList(),
    aupFile
  );
}
