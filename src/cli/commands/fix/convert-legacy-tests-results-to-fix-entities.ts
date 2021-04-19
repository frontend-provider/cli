import * as fs from 'fs';
import * as pathLib from 'path';
import { convertLegacyTestResultToNew } from './convert-legacy-test-result-to-new';
import { convertLegacyTestResultToScanResult } from './convert-legacy-test-result-to-scan-result';
import { TestResult } from '../../../lib/snyk-test/legacy';
import { EntityToFix } from '@snyk/fix';
import { Options, TestOptions } from '../../../lib/types';

export function convertLegacyTestResultToFixEntities(
  testResults: (TestResult | TestResult[]) | Error,
  root: string,
  options: Partial<Options & TestOptions>,
): EntityToFix[] {
  if (testResults instanceof Error) {
    return [];
  }
  const oldResults = Array.isArray(testResults) ? testResults : [testResults];
  return oldResults.map((res) => ({
    options,
    workspace: {
      path: root,
      readFile: async (path: string) => {
        return fs.readFileSync(pathLib.resolve(root, path), 'utf8');
      },
      writeFile: async (path: string, content: string) => {
        return fs.writeFileSync(pathLib.resolve(root, path), content, 'utf8');
      },
    },
    scanResult: convertLegacyTestResultToScanResult(res),
    testResult: convertLegacyTestResultToNew(res),
  }));
}
