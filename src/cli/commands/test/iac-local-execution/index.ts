import { isLocalFolder } from '../../../../lib/detect';
import {
  EngineType,
  IacFileParsed,
  IacFileParseFailure,
  IaCTestFlags,
  RulesOrigin,
  SafeAnalyticsOutput,
  TestReturnValue,
  VALID_FILE_TYPES,
  ValidFileType,
} from './types';
import { addIacAnalytics } from './analytics';
import { TestLimitReachedError } from './usage-tracking';
import { filterIgnoredIssues } from './policy';
import { TestResult } from '../../../../lib/snyk-test/legacy';
import {
  applyCustomSeverities,
  cleanLocalCache,
  formatScanResults,
  getIacOrgSettings,
  loadFiles,
  parseFiles,
  scanFiles,
  trackUsage,
  loadAndParseTerraformFiles,
} from './measurable-methods';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';
import config from '../../../../lib/config';
import { findAndLoadPolicy } from '../../../../lib/policy';
import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import { initRules } from './rules';
import { NoFilesToScanError } from './file-loader';
import { formatAndShareResults } from './share-results';
import { generateProjectAttributes, generateTags } from '../../monitor';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  try {
    const orgPublicId = options.org ?? config.org;
    const iacOrgSettings = await getIacOrgSettings(orgPublicId);

    if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
      throw new UnsupportedEntitlementError('infrastructureAsCode');
    }

    // Parse tags and attributes right now, so we can exit early if the user
    // provided invalid values.
    const tags = parseTags(options);
    const attributes = parseAttributes(options);

    const rulesOrigin = await initRules(iacOrgSettings, options);

    const policy = await findAndLoadPolicy(pathToScan, 'iac', options);

    let parsedFiles: IacFileParsed[] = [];
    let failedFiles: IacFileParseFailure[] = [];
    const isTFVarSupportEnabled = (
      await isFeatureFlagSupportedForOrg(
        'iacTerraformVarSupport',
        iacOrgSettings.meta.org,
      )
    ).ok;

    // if TF vars enabled, valid files are all except terraform files
    const validFileTypes = isTFVarSupportEnabled
      ? VALID_FILE_TYPES.filter(
          (fileType) =>
            fileType !== ValidFileType.Terraform &&
            fileType !== ValidFileType.TFVARS,
        )
      : undefined;

    try {
      // load and parse all files that are a valid file type
      const filesToParse = await loadFiles(pathToScan, options, validFileTypes);
      ({ parsedFiles, failedFiles } = await parseFiles(filesToParse, options));
    } catch (err) {
      if (
        validFileTypes &&
        !validFileTypes.includes(ValidFileType.Terraform) &&
        err instanceof NoFilesToScanError
      ) {
        // ignore this error since we might only have .tf files in the folder and we will parse them in the next block
      } else {
        throw err;
      }
    }

    // we may have loaded and parsed all but terraform files in the previous step
    // so now we check if we need to do a second load and parse which dereferences TF vars
    if (validFileTypes && !validFileTypes.includes(ValidFileType.Terraform)) {
      try {
        const {
          parsedFiles: tfParsedFiles,
          failedFiles: tfFailedFiles,
        } = await loadAndParseTerraformFiles(
          pathToScan,
          options.detectionDepth,
        );
        parsedFiles = parsedFiles.concat(tfParsedFiles);
        failedFiles = failedFiles.concat(tfFailedFiles);
      } catch (err) {
        if (parsedFiles.length > 0 && err instanceof NoFilesToScanError) {
          // ignore this error since we've discovered non-terraform files in the previous block
        } else {
          throw err;
        }
      }
    }

    // Duplicate all the files and run them through the custom engine.
    if (rulesOrigin !== RulesOrigin.Internal) {
      parsedFiles.push(
        ...parsedFiles.map((file) => ({
          ...file,
          engineType: EngineType.Custom,
        })),
      );
    }

    const scannedFiles = await scanFiles(parsedFiles);
    const resultsWithCustomSeverities = await applyCustomSeverities(
      scannedFiles,
      iacOrgSettings.customPolicies,
    );

    let projectPublicIds: Record<string, string> = {};
    let gitRemoteUrl: string | undefined;

    if (options.report) {
      ({ projectPublicIds, gitRemoteUrl } = await formatAndShareResults({
        results: resultsWithCustomSeverities,
        options,
        orgPublicId,
        policy,
        tags,
        attributes,
      }));
    }

    const formattedResults = formatScanResults(
      resultsWithCustomSeverities,
      options,
      iacOrgSettings.meta,
      projectPublicIds,
      gitRemoteUrl,
    );

    const { filteredIssues, ignoreCount } = filterIgnoredIssues(
      policy,
      formattedResults,
    );

    try {
      await trackUsage(filteredIssues);
    } catch (e) {
      if (e instanceof TestLimitReachedError) {
        throw e;
      }
      // If something has gone wrong, err on the side of allowing the user to
      // run their tests by squashing the error.
    }

    addIacAnalytics(filteredIssues, {
      ignoredIssuesCount: ignoreCount,
      rulesOrigin,
    });

    // TODO: add support for proper typing of old TestResult interface.
    return {
      results: (filteredIssues as unknown) as TestResult[],
      // NOTE: No file or parsed file data should leave this function.
      failures: isLocalFolder(pathToScan)
        ? failedFiles.map(removeFileContent)
        : undefined,
    };
  } finally {
    cleanLocalCache();
  }
}

export function removeFileContent({
  filePath,
  fileType,
  failureReason,
  projectType,
}: IacFileParsed | IacFileParseFailure): SafeAnalyticsOutput {
  return {
    filePath,
    fileType,
    failureReason,
    projectType,
  };
}

function parseTags(options: IaCTestFlags) {
  if (options.report) {
    return generateTags(options);
  }
}

function parseAttributes(options: IaCTestFlags) {
  if (options.report) {
    return generateProjectAttributes(options);
  }
}
