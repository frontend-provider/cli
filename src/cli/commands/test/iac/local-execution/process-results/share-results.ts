import { isFeatureFlagSupportedForOrg } from '../../../../../../lib/feature-flags';
import { shareResults } from './cli-share-results';
import { Policy } from '../../../../../../lib/policy/find-and-load-policy';
import {
  IacOutputMeta,
  ProjectAttributes,
  Tag,
} from '../../../../../../lib/types';
import { FeatureFlagError } from '../assert-iac-options-flag';
import { formatShareResults } from './share-results-formatter';
import { IacFileScanResult, IaCTestFlags, ShareResultsOutput } from '../types';

export async function formatAndShareResults({
  results,
  options,
  orgPublicId,
  policy,
  tags,
  attributes,
  projectRoot,
  meta,
}: {
  results: IacFileScanResult[];
  options: IaCTestFlags;
  orgPublicId: string;
  policy: Policy | undefined;
  tags?: Tag[];
  attributes?: ProjectAttributes;
  projectRoot: string;
  meta: IacOutputMeta;
}): Promise<ShareResultsOutput> {
  const isCliReportEnabled = await isFeatureFlagSupportedForOrg(
    'iacCliShareResults',
    orgPublicId,
  );
  if (!isCliReportEnabled.ok) {
    throw new FeatureFlagError('report', 'iacCliShareResults');
  }

  const formattedResults = formatShareResults(projectRoot, results, meta);

  return await shareResults({
    results: formattedResults,
    policy,
    tags,
    attributes,
    options,
    meta,
  });
}
