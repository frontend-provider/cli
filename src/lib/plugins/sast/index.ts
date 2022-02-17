import chalk from 'chalk';
import * as debugLib from 'debug';
import { v4 as uuidv4 } from 'uuid';
import { getCodeAnalysisAndParseResults } from './analysis';
import { getSastSettings } from './settings';
import {
  getCodeDisplayedOutput,
  getPrefix,
  getMeta,
} from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';
import { FailedToRunTestError, NoSupportedSastFiles } from '../../errors';
import { jsonStringifyLargeObject } from '../../json';
import * as analytics from '../../analytics';

const debug = debugLib('snyk-code');

export const codePlugin: EcosystemPlugin = {
  // We currently don't use scan/display. we will need to consolidate ecosystem plugins
  // to accept flows that act differently in the `testDependencies` step, as we have here
  async scan() {
    return null as any;
  },
  async display() {
    return '';
  },
  async test(paths, options) {
    const requestId = uuidv4();
    debug(`Request ID: ${requestId}`);
    try {
      analytics.add('sast-scan', true);
      const sastSettings = await getSastSettings(options);
      // Currently code supports only one path
      const path = paths[0];

      const sarifTypedResult = await getCodeAnalysisAndParseResults(
        path,
        options,
        sastSettings,
        requestId,
      );

      if (!sarifTypedResult) {
        throw new NoSupportedSastFiles();
      }
      const numOfIssues = sarifTypedResult!.runs?.[0].results?.length || 0;
      analytics.add('sast-issues-found', numOfIssues);
      const meta = getMeta(options, path);
      const prefix = getPrefix(path);
      let readableResult = getCodeDisplayedOutput(
        sarifTypedResult!,
        meta,
        prefix,
      );
      let sarifResult;
      if (numOfIssues > 0 && options['no-markdown']) {
        sarifTypedResult.runs?.[0].results?.forEach(({ message }) => {
          delete message.markdown;
        });
      }
      if (options['sarif-file-output']) {
        sarifResult = jsonStringifyLargeObject(sarifTypedResult);
      }
      if (options.sarif || options.json) {
        readableResult = jsonStringifyLargeObject(sarifTypedResult);
      }
      if (numOfIssues > 0) {
        hasIssues(readableResult, sarifResult);
      }
      return sarifResult ? { readableResult, sarifResult } : { readableResult };
    } catch (error) {
      let err: Error;
      if (isCodeClientError(error)) {
        const isUnauthorized = isUnauthorizedError(error)
          ? 'Unauthorized: '
          : '';
        err = new FailedToRunTestError(
          `${isUnauthorized}Failed to run 'code test'`,
          error.statusCode,
        );
      } else if (error instanceof Error) {
        err = error;
      } else if (isUnauthorizedError(error)) {
        err = new FailedToRunTestError(error.message, error.code);
      } else {
        err = new Error(error);
      }
      debug(
        chalk.bold.red(
          `requestId: ${requestId} statusCode:${error.code ||
            error.statusCode}, message: ${error.statusText || error.message}`,
        ),
      );
      throw err;
    }
  },
};

function isCodeClientError(error: object): boolean {
  return (
    error.hasOwnProperty('statusCode') &&
    error.hasOwnProperty('statusText') &&
    error.hasOwnProperty('apiName')
  );
}

function isUnauthorizedError(error: any): boolean {
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.code === 403 ||
    error.code === 401
  );
}

function hasIssues(readableResult: string, sarifResult?: string): Error {
  const err = new Error(readableResult) as any;
  err.code = 'VULNS';
  if (sarifResult !== undefined) {
    err.sarifStringifiedResults = sarifResult;
  }
  throw err;
}
