#!/usr/bin/env node
import 'source-map-support/register';
import * as Debug from 'debug';
import * as pathLib from 'path';

// assert supported node runtime version
import * as runtime from './runtime';
// require analytics as soon as possible to start measuring execution time
import * as analytics from '../lib/analytics';
import * as alerts from '../lib/alerts';
import * as sln from '../lib/sln';
import { args as argsLib, Args, ArgsOptions } from './args';
import { TestCommandResult } from './commands/types';
import { copy } from './copy';
import spinner = require('../lib/spinner');
import errors = require('../lib/errors/legacy-errors');
import ansiEscapes = require('ansi-escapes');
import { isPathToPackageFile } from '../lib/detect';
import { updateCheck } from '../lib/updater';
import {
  MissingTargetFileError,
  FileFlagBadInputError,
  OptionMissingErrorError,
  UnsupportedOptionCombinationError,
  ExcludeFlagBadInputError,
  CustomError,
} from '../lib/errors';
import stripAnsi from 'strip-ansi';
import { ExcludeFlagInvalidInputError } from '../lib/errors/exclude-flag-invalid-input';
import { modeValidation } from './modes';
import { JsonFileOutputBadInputError } from '../lib/errors/json-file-output-bad-input-error';
import {
  createDirectory,
  writeContentsToFileSwallowingErrors,
} from '../lib/json-file-output';
import {
  Options,
  TestOptions,
  MonitorOptions,
  SupportedUserReachableFacingCliArgs,
} from '../lib/types';
import { SarifFileOutputEmptyError } from '../lib/errors/empty-sarif-output-error';
import { InvalidDetectionDepthValue } from '../lib/errors/invalid-detection-depth-value';

const debug = Debug('snyk');
const EXIT_CODES = {
  VULNS_FOUND: 1,
  ERROR: 2,
  NO_SUPPORTED_MANIFESTS_FOUND: 3,
};

async function runCommand(args: Args) {
  const commandResult = await args.method(...args.options._);

  const res = analytics.addDataAndSend({
    args: args.options._,
    command: args.command,
    org: args.options.org,
  });

  if (!commandResult) {
    return;
  }

  const result = commandResult.toString();

  if (result && !args.options.quiet) {
    if (args.options.copy) {
      copy(result);
      console.log('Result copied to clipboard');
    } else {
      console.log(result);
    }
  }

  // also save the json (in error.json) to file if option is set
  if (args.command === 'test') {
    const jsonResults = (commandResult as TestCommandResult).getJsonResult();
    saveResultsToFile(args.options, 'json', jsonResults);
    const sarifResults = (commandResult as TestCommandResult).getSarifResult();
    saveResultsToFile(args.options, 'sarif', sarifResults);
  }

  return res;
}

async function handleError(args, error) {
  spinner.clearAll();
  let command = 'bad-command';
  let exitCode = EXIT_CODES.ERROR;
  const noSupportedManifestsFound = error.message?.includes(
    'Could not detect supported target files in',
  );

  if (noSupportedManifestsFound) {
    exitCode = EXIT_CODES.NO_SUPPORTED_MANIFESTS_FOUND;
  }

  const vulnsFound = error.code === 'VULNS';
  if (vulnsFound) {
    // this isn't a bad command, so we won't record it as such
    command = args.command;
    exitCode = EXIT_CODES.VULNS_FOUND;
  }

  if (args.options.debug && !args.options.json) {
    const output = vulnsFound ? error.message : error.stack;
    console.log(output);
  } else if (
    args.options.json &&
    !(error instanceof UnsupportedOptionCombinationError)
  ) {
    console.log(stripAnsi(error.json || error.stack));
  } else {
    if (!args.options.quiet) {
      const result = errors.message(error);
      if (args.options.copy) {
        copy(result);
        console.log('Result copied to clipboard');
      } else {
        if (`${error.code}`.indexOf('AUTH_') === 0) {
          // remove the last few lines
          const erase = ansiEscapes.eraseLines(4);
          process.stdout.write(erase);
        }
        console.log(result);
      }
    }
  }

  saveResultsToFile(args.options, 'json', error.jsonStringifiedResults);
  saveResultsToFile(args.options, 'sarif', error.sarifStringifiedResults);

  const analyticsError = vulnsFound
    ? {
        stack: error.jsonNoVulns,
        code: error.code,
        message: 'Vulnerabilities found',
      }
    : {
        stack: error.stack,
        code: error.code,
        message: error.message,
      };

  if (!vulnsFound && !error.stack) {
    // log errors that are not error objects
    analytics.add('error', true);
    analytics.add('command', args.command);
  } else {
    analytics.add('error-message', analyticsError.message);
    // Note that error.stack would also contain the error message
    // (see https://nodejs.org/api/errors.html#errors_error_stack)
    analytics.add('error', analyticsError.stack);
    analytics.add('error-code', error.code);
    analytics.add('command', args.command);
  }

  const res = analytics.addDataAndSend({
    args: args.options._,
    command,
    org: args.options.org,
  });

  return { res, exitCode };
}

function getFullPath(filepathFragment: string): string {
  if (pathLib.isAbsolute(filepathFragment)) {
    return filepathFragment;
  } else {
    const fullPath = pathLib.join(process.cwd(), filepathFragment);
    return fullPath;
  }
}

function saveJsonResultsToFile(
  stringifiedJson: string,
  jsonOutputFile: string,
) {
  if (!jsonOutputFile) {
    console.error('empty jsonOutputFile');
    return;
  }

  if (jsonOutputFile.constructor.name !== String.name) {
    console.error('--json-output-file should be a filename path');
    return;
  }

  // create the directory if it doesn't exist
  const dirPath = pathLib.dirname(jsonOutputFile);
  const createDirSuccess = createDirectory(dirPath);
  if (createDirSuccess) {
    writeContentsToFileSwallowingErrors(jsonOutputFile, stringifiedJson);
  }
}

function checkRuntime() {
  if (!runtime.isSupported(process.versions.node)) {
    console.error(
      `${process.versions.node} is an unsupported nodejs ` +
        `runtime! Supported runtime range is '${runtime.supportedRange}'`,
    );
    console.error('Please upgrade your nodejs runtime version and try again.');
    process.exit(EXIT_CODES.ERROR);
  }
}

// Throw error if user specifies package file name as part of path,
// and if user specifies multiple paths and used project-name option.
function checkPaths(args) {
  let count = 0;
  for (const path of args.options._) {
    if (typeof path === 'string' && isPathToPackageFile(path)) {
      throw MissingTargetFileError(path);
    } else if (typeof path === 'string') {
      if (++count > 1 && args.options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'multiple paths',
          'project-name',
        ]);
      }
    }
  }
}

type AllSupportedCliOptions = Options & MonitorOptions & TestOptions;

async function main() {
  updateCheck();
  checkRuntime();

  const args = argsLib(process.argv);
  let res;
  let failed = false;
  let exitCode = EXIT_CODES.ERROR;
  try {
    modeValidation(args);
    // TODO: fix this, we do transformation to options and teh type doesn't reflect it
    validateUnsupportedOptionCombinations(
      (args.options as unknown) as AllSupportedCliOptions,
    );

    if (args.options['app-vulns'] && args.options['json']) {
      throw new UnsupportedOptionCombinationError([
        'Application vulnerabilities is currently not supported with JSON output. ' +
          'Please try using —app-vulns only to get application vulnerabilities, or ' +
          '—json only to get your image vulnerabilties, excluding the application ones.',
      ]);
    }
    if (args.options['group-issues'] && args.options['iac']) {
      throw new UnsupportedOptionCombinationError([
        '--group-issues is currently not supported for Snyk IaC.',
      ]);
    }
    if (
      args.options['group-issues'] &&
      !args.options['json'] &&
      !args.options['json-file-output']
    ) {
      throw new UnsupportedOptionCombinationError([
        'JSON output is required to use --group-issues, try adding --json.',
      ]);
    }

    if (
      args.options.file &&
      typeof args.options.file === 'string' &&
      (args.options.file as string).match(/\.sln$/)
    ) {
      if (args.options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'file=*.sln',
          'project-name',
        ]);
      }
      sln.updateArgs(args);
    } else if (typeof args.options.file === 'boolean') {
      throw new FileFlagBadInputError();
    }

    if (
      typeof args.options.detectionDepth !== 'undefined' &&
      (args.options.detectionDepth <= 0 ||
        Number.isNaN(args.options.detectionDepth))
    ) {
      throw new InvalidDetectionDepthValue();
    }

    validateUnsupportedSarifCombinations(args);

    validateOutputFile(args.options, 'json', new JsonFileOutputBadInputError());
    validateOutputFile(args.options, 'sarif', new SarifFileOutputEmptyError());

    checkPaths(args);

    res = await runCommand(args);
  } catch (error) {
    failed = true;

    const response = await handleError(args, error);
    res = response.res;
    exitCode = response.exitCode;
  }

  if (!args.options.json) {
    console.log(alerts.displayAlerts());
  }

  if (!process.env.TAP && failed) {
    debug('Exit code: ' + exitCode);
    process.exitCode = exitCode;
  }

  return res;
}

const cli = main().catch((e) => {
  console.error('Something unexpected went wrong: ', e.stack);
  console.error('Exit code: ' + EXIT_CODES.ERROR);
  process.exit(EXIT_CODES.ERROR);
});

if (module.parent) {
  // eslint-disable-next-line id-blacklist
  module.exports = cli;
}

function validateUnsupportedOptionCombinations(
  options: AllSupportedCliOptions,
): void {
  const unsupportedAllProjectsCombinations: {
    [name: string]: SupportedUserReachableFacingCliArgs;
  } = {
    'project-name': 'project-name',
    file: 'file',
    yarnWorkspaces: 'yarn-workspaces',
    packageManager: 'package-manager',
    docker: 'docker',
    allSubProjects: 'all-sub-projects',
  };

  const unsupportedYarnWorkspacesCombinations: {
    [name: string]: SupportedUserReachableFacingCliArgs;
  } = {
    'project-name': 'project-name',
    file: 'file',
    packageManager: 'package-manager',
    docker: 'docker',
    allSubProjects: 'all-sub-projects',
  };

  if (options.scanAllUnmanaged && options.file) {
    throw new UnsupportedOptionCombinationError(['file', 'scan-all-unmanaged']);
  }

  if (options.allProjects) {
    for (const option in unsupportedAllProjectsCombinations) {
      if (options[option]) {
        throw new UnsupportedOptionCombinationError([
          unsupportedAllProjectsCombinations[option],
          'all-projects',
        ]);
      }
    }
  }

  if (options.yarnWorkspaces) {
    for (const option in unsupportedYarnWorkspacesCombinations) {
      if (options[option]) {
        throw new UnsupportedOptionCombinationError([
          unsupportedAllProjectsCombinations[option],
          'yarn-workspaces',
        ]);
      }
    }
  }

  if (options.exclude) {
    if (!(options.allProjects || options.yarnWorkspaces)) {
      throw new OptionMissingErrorError('--exclude', [
        '--yarn-workspaces',
        '--all-projects',
      ]);
    }
    if (typeof options.exclude !== 'string') {
      throw new ExcludeFlagBadInputError();
    }
    if (options.exclude.indexOf(pathLib.sep) > -1) {
      throw new ExcludeFlagInvalidInputError();
    }
  }
}

function validateUnsupportedSarifCombinations(args) {
  if (args.options['json-file-output'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'json-file-output',
    ]);
  }

  if (args.options['sarif'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([args.command, 'sarif']);
  }

  if (args.options['sarif'] && args.options['json']) {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'sarif',
      'json',
    ]);
  }

  if (args.options['sarif-file-output'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'sarif-file-output',
    ]);
  }

  if (
    args.options['sarif'] &&
    args.options['docker'] &&
    !args.options['file']
  ) {
    throw new OptionMissingErrorError('sarif', ['--file']);
  }

  if (
    args.options['sarif-file-output'] &&
    args.options['docker'] &&
    !args.options['file']
  ) {
    throw new OptionMissingErrorError('sarif-file-output', ['--file']);
  }
}

function saveResultsToFile(
  options: ArgsOptions,
  outputType: string,
  jsonResults: string,
) {
  const flag = `${outputType}-file-output`;
  const outputFile = options[flag];
  if (outputFile && jsonResults) {
    const outputFileStr = outputFile as string;
    const fullOutputFilePath = getFullPath(outputFileStr);
    saveJsonResultsToFile(stripAnsi(jsonResults), fullOutputFilePath);
  }
}

function validateOutputFile(
  options: ArgsOptions,
  outputType: string,
  error: CustomError,
) {
  const fileOutputValue = options[`${outputType}-file-output`];

  if (fileOutputValue === undefined) {
    return;
  }

  if (!fileOutputValue || typeof fileOutputValue !== 'string') {
    throw error;
  }
  // On Windows, seems like quotes get passed in
  if (fileOutputValue === "''" || fileOutputValue === '""') {
    throw error;
  }
}
