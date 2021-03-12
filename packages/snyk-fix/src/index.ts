import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as ora from 'ora';
import * as chalk from 'chalk';
import stripAnsi = require('strip-ansi');

import * as outputFormatter from './lib/output-formatters/show-results-summary';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResultByPlugin } from './plugins/types';

import { EntityToFix, ErrorsByEcoSystem, FixOptions } from './types';
import { convertErrorToUserMessage } from './lib/errors/error-to-user-message';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
  options: FixOptions = {
    dryRun: false,
    quiet: false,
    stripAnsi: false,
  },
): Promise<{
  results: FixHandlerResultByPlugin;
  exceptions: ErrorsByEcoSystem;
  meta: { fixed: number; failed: number };
  fixSummary: string;
}> {
  const spinner = ora({ isSilent: options.quiet });
  let resultsByPlugin: FixHandlerResultByPlugin = {};
  const entitiesPerType = groupEntitiesPerScanType(entities);
  const exceptionsByScanType: ErrorsByEcoSystem = {};
  await pMap(
    Object.keys(entitiesPerType),
    async (scanType) => {
      try {
        const fixPlugin = loadPlugin(scanType);
        const results = await fixPlugin(entitiesPerType[scanType], options);
        resultsByPlugin = { ...resultsByPlugin, ...results };
      } catch (e) {
        debug(`Failed to processes ${scanType}`, e);
        exceptionsByScanType[scanType] = {
          originals: entitiesPerType[scanType],
          userMessage: convertErrorToUserMessage(e),
        };
      }
    },
    {
      concurrency: 3,
    },
  );
  const fixSummary = await outputFormatter.showResultsSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );

  const failed = outputFormatter.calculateFailed(
    resultsByPlugin,
    exceptionsByScanType,
  );
  const fixed = outputFormatter.calculateFixed(resultsByPlugin);

  spinner.start();
  spinner.stopAndPersist({ text: 'Done', symbol: chalk.green('✔') });
  spinner.stopAndPersist({ text: `\n${fixSummary}` });
  return {
    results: resultsByPlugin,
    exceptions: exceptionsByScanType,
    fixSummary: options.stripAnsi ? stripAnsi(fixSummary) : fixSummary,
    meta: { fixed, failed },
  };
}

export function groupEntitiesPerScanType(
  entities: EntityToFix[],
): {
  [type: string]: EntityToFix[];
} {
  const entitiesPerType: {
    [type: string]: EntityToFix[];
  } = {};
  for (const entity of entities) {
    const type = entity.scanResult?.identity?.type || 'missing-type';
    if (entitiesPerType[type]) {
      entitiesPerType[type].push(entity);
      continue;
    }
    entitiesPerType[type] = [entity];
  }
  return entitiesPerType;
}
