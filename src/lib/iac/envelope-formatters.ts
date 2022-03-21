import {
  IacShareResultsFormat,
  PolicyMetadata,
} from '../../cli/commands/test/iac-local-execution/types';
import { GitTarget, ScanResult } from '../ecosystems/types';
import { Policy } from '../policy/find-and-load-policy';

export function convertIacResultToScanResult(
  iacResult: IacShareResultsFormat,
  policy: Policy | undefined,
  gitTarget: GitTarget,
): ScanResult {
  return {
    identity: {
      type: iacResult.projectType,
      targetFile: iacResult.targetFile,
    },
    facts: [],
    findings: iacResult.violatedPolicies.map((policy: PolicyMetadata) => {
      return {
        data: { metadata: policy, docId: policy.docId },
        type: 'iacIssue',
      };
    }),
    name: iacResult.projectName,
    target:
      Object.keys(gitTarget).length === 0
        ? { name: iacResult.projectName }
        : { ...gitTarget, branch: 'master' },
    policy: policy?.toString() ?? '',
  };
}
