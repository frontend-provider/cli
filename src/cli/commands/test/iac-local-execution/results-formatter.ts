import {
  EngineType,
  FormattedResult,
  IacFileScanResult,
  IacOptionFlags,
  PolicyMetadata,
} from './types';
import { SEVERITY } from '../../../../lib/snyk-test/common';
import { IacProjectType } from '../../../../lib/iac/constants';
// import {
//   issuesToLineNumbers,
//   CloudConfigFileTypes,
// } from '@snyk/cloud-config-parser';

const SEVERITIES = [SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH];

export function formatScanResults(
  scanResults: Array<IacFileScanResult>,
  options: IacOptionFlags,
): FormattedResult[] {
  // Relevant only for multi-doc yaml files
  const scannedResultsGroupedByDocId = groupMultiDocResults(scanResults);
  const formattedResults = scannedResultsGroupedByDocId.map((iacScanResult) =>
    formatScanResult(iacScanResult, options.severityThreshold),
  );

  return formattedResults;
}

//
// function getFileTypeForLineNumber(
//   fileType: string,
// ): CloudConfigFileTypes {
//   switch (fileType) {
//     case 'yaml':
//     case 'yml':
//       return CloudConfigFileTypes.YAML;
//     case 'json':
//       return CloudConfigFileTypes.JSON;
//     default:
//       return CloudConfigFileTypes.YAML;
//   }
// }

const engineTypeToProjectType = {
  [EngineType.Kubernetes]: IacProjectType.K8S,
  [EngineType.Terraform]: IacProjectType.TERRAFORM,
};

function formatScanResult(
  scanResult: IacFileScanResult,
  severityThreshold?: SEVERITY,
): FormattedResult {
  const formattedIssues = scanResult.violatedPolicies.map((policy) => {
    // TODO: make sure we handle this issue with annotations:
    // https://github.com/snyk/registry/pull/17277
    const cloudConfigPath =
      scanResult.docId !== undefined
        ? [`[DocId:${scanResult.docId}]`].concat(policy.msg.split('.'))
        : policy.msg.split('.');
    const lineNumber = -1;
    // TODO: once package becomes public, restore the commented out code for having the issue-to-line-number functionality
    // try {
    //   lineNumber = issuesToLineNumbers(
    //     iacFileScanResult.fileContent,
    //     getFileTypeForLineNumber(iacFileScanResult.fileType),
    //     cloudConfigPath,
    //   );
    // } catch (err) {
    //   //
    // }

    return {
      ...policy,
      id: policy.publicId,
      name: policy.title,
      cloudConfigPath,
      isIgnored: false,
      iacDescription: {
        issue: policy.issue,
        impact: policy.impact,
        resolve: policy.resolve,
      },
      severity: policy.severity,
      lineNumber: lineNumber,
    };
  });
  return {
    result: {
      cloudConfigResults: filterPoliciesBySeverity(
        formattedIssues,
        severityThreshold,
      ),
    },
    isPrivate: true,
    packageManager: engineTypeToProjectType[scanResult.engineType],
    targetFile: scanResult.filePath,
  };
}

function groupMultiDocResults(
  scanResults: Array<IacFileScanResult>,
): Array<IacFileScanResult> {
  const groupedData = scanResults.reduce((memo, result) => {
    if (memo[result.filePath]) {
      memo[result.filePath].violatedPolicies = memo[
        result.filePath
      ].violatedPolicies.concat(result.violatedPolicies);
    } else {
      memo[result.filePath] = result;
    }

    return memo;
  }, {} as IacFileScanResult);

  return Object.values(groupedData);
}

function filterPoliciesBySeverity(
  violatedPolicies: PolicyMetadata[],
  severityThreshold?: SEVERITY,
): PolicyMetadata[] {
  if (!severityThreshold || severityThreshold === SEVERITY.LOW) {
    return violatedPolicies;
  }

  const severitiesToInclude = SEVERITIES.slice(
    SEVERITIES.indexOf(severityThreshold),
  );

  return violatedPolicies.filter((policy) =>
    severitiesToInclude.includes(policy.severity),
  );
}
