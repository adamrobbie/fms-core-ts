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
 * Print iterations progress, copy from https://stackoverflow.com/questions/3173320/text-progress-bar-in-the-console
 */
export function printProgressBar(
  iteration: number,
  total: number,
  prefix: string = '',
  suffix: string = '',
  decimals: number = 1,
  length: number = 100,
  fill: string = '█',
  printEnd: string = '\r'
): void {
  /**
   * Call in a loop to create terminal progress bar
   * @params:
   *   iteration   - Required  : current iteration (Int)
   *   total       - Required  : total iterations (Int)
   *   prefix      - Optional  : prefix string (Str)
   *   suffix      - Optional  : suffix string (Str)
   *   decimals    - Optional  : positive number of decimals in percent complete (Int)
   *   length      - Optional  : character length of bar (Int)
   *   fill        - Optional  : bar fill character (Str)
   *   printEnd    - Optional  : end character (e.g. "\r", "\r\n") (Str)
   */
  const percent = (100 * (iteration / total)).toFixed(decimals);
  const filledLength = Math.floor((length * iteration) / total);
  const bar = fill.repeat(filledLength) + '-'.repeat(length - filledLength);
  process.stdout.write(`\r${prefix} |${bar}| ${percent}% ${suffix}`);

  // Print New Line on Complete
  if (iteration === total) {
    process.stdout.write('\n');
  }
}
