import * as _ from 'lodash';
import * as depGraphLib from '@snyk/dep-graph';
import { SupportedPackageManagers } from '../package-managers';
import { SEVERITIES } from './common';

interface Pkg {
  name: string;
  version?: string;
}

interface Patch {
  version: string;
  id: string;
  urls: string[];
  modificationTime: string;
}

export enum SEVERITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface VulnMetaData {
  id: string;
  title: string;
  description: string;
  type: 'license' | 'vuln';
  name: string;
  info: string;
  severity: SEVERITY;
  severityValue: number;
  isNew: boolean;
  version: string;
  packageManager: SupportedPackageManagers | 'upstream';
}

export interface GroupedVuln {
  list: AnnotatedIssue[];
  metadata: VulnMetaData;
  isIgnored: boolean;
  title: string;
  note: string | false;
  severity: SEVERITY;
  isNew: boolean;
  name: string;
  version: string;
  isFixable: boolean;
  fixedIn: string[];
  legalInstructionsArray?: LegalInstruction[];
}

export interface LegalInstruction {
  licenseName: string;
  legalContent: string;
}
export interface IssueData {
  id: string;
  packageName: string;
  version: string;
  moduleName?: string;
  below: string; // Vulnerable below version
  semver: {
    vulnerable: string | string[];
    vulnerableHashes?: string[];
    vulnerableByDistro?: {
      [distroNameAndVersion: string]: string[];
    };
  };
  patches: Patch[];
  isNew: boolean;
  description: string;
  title: string;
  severity: SEVERITY;
  fixedIn: string[];
  legalInstructions?: string;
}

interface AnnotatedIssue extends IssueData {
  credit: any;
  name: string;
  version: string;
  from: string[];
  upgradePath: Array<string | boolean>;
  isUpgradable: boolean;
  isPatchable: boolean;
  severity: SEVERITY;

  // These fields present for "node_module" based scans to allow remediation
  bundled?: any;
  shrinkwrap?: any;
  __filename?: string;
  parentDepType: string;

  type?: 'license';
  title: string;
  patch?: any;
  note?: string | false;
  publicationTime?: string;
}

// Mixin, to be added to GroupedVuln / AnnotatedIssue
export interface DockerIssue {
  nearestFixedInVersion?: string;
  dockerfileInstruction?: any;
  dockerBaseImage?: any;
}

export interface IgnoreSettings {
  adminOnly: boolean;
  reasonRequired: boolean;
  disregardFilesystemIgnores: boolean;
}

export interface LegacyVulnApiResult {
  vulnerabilities: AnnotatedIssue[];
  ok: boolean;
  dependencyCount: number;
  org: string;
  policy: string;
  isPrivate: boolean;
  licensesPolicy: object | null;
  packageManager: string;
  ignoreSettings: IgnoreSettings | null;
  summary: string;
  docker?: {
    baseImage?: any;
    binariesVulns?: unknown;
    baseImageRemediation?: BaseImageRemediation;
  };
  severityThreshold?: string;

  filesystemPolicy?: boolean;
  uniqueCount?: any;
  remediation?: RemediationChanges;
}

export interface BaseImageRemediation {
  code: string;
  advice: BaseImageRemediationAdvice[];
  message?: string; // TODO: check if this is still being sent
}

export interface BaseImageRemediationAdvice {
  message: string;
  bold?: boolean;
  color?: string;
}

export interface TestResult extends LegacyVulnApiResult {
  targetFile?: string;
  projectName?: string;
  displayTargetFile?: string; // used for display only
}

interface UpgradePathItem {
  name: string;
  version: string;
  newVersion?: string;
  isDropped?: boolean;
}

interface UpgradePath {
  path: UpgradePathItem[];
}

interface FixInfo {
  upgradePaths: UpgradePath[];
  isPatchable: boolean;
  nearestFixedInVersion?: string;
}

interface TestDepGraphResult {
  issuesData: {
    [issueId: string]: IssueData;
  };
  affectedPkgs: {
    [pkgId: string]: {
      pkg: Pkg;
      issues: {
        [issueId: string]: {
          issueId: string;
          fixInfo: FixInfo;
        };
      };
    };
  };
  docker: {
    binariesVulns?: TestDepGraphResult;
    baseImage?: any;
  };
  remediation?: RemediationChanges;
}

interface TestDepGraphMeta {
  isPublic: boolean;
  isLicensesEnabled: boolean;
  licensesPolicy?: {
    severities: {
      [type: string]: string;
    };
  };
  ignoreSettings?: IgnoreSettings;
  policy: string;
  org: string;
}

export interface TestDepGraphResponse {
  result: TestDepGraphResult;
  meta: TestDepGraphMeta;
}

export interface Ignores {
  [path: string]: {
    paths: string[][];
    meta: {
      days?: number;
      reason?: string;
    };
  };
}

export interface PatchObject {
  [name: string]: {
    patched: string;
  };
}

export interface Upgrade {
  upgradeTo: string; // name@version
}

export interface UpgradeVulns extends Upgrade {
  vulns: string[];
}

export interface UpgradeRemediation extends UpgradeVulns {
  upgrades: string[];
}

export interface PatchRemediation {
  paths: PatchObject[];
}

export interface DependencyUpdates {
  [from: string]: UpgradeRemediation;
}

export interface PinRemediation extends UpgradeVulns {
  isTransitive: boolean;
}

export interface DependencyPins {
  [name: string]: PinRemediation;
}

// Remediation changes to be applied to the project,
// including information on all and unresolved issues.
export interface RemediationChanges {
  unresolved: IssueData[];
  upgrade: DependencyUpdates;
  patch: {
    [name: string]: PatchRemediation;
  };
  ignore: unknown;
  pin: DependencyPins;
}

function convertTestDepGraphResultToLegacy(
  res: TestDepGraphResponse,
  depGraph: depGraphLib.DepGraph,
  packageManager: string,
  severityThreshold?: SEVERITY,
): LegacyVulnApiResult {
  const result = res.result;

  const upgradePathsMap = new Map<string, string[]>();

  for (const pkgInfo of _.values(result.affectedPkgs)) {
    for (const pkgIssue of _.values(pkgInfo.issues)) {
      if (pkgIssue.fixInfo && pkgIssue.fixInfo.upgradePaths) {
        for (const upgradePath of pkgIssue.fixInfo.upgradePaths) {
          const legacyFromPath = pkgPathToLegacyPath(upgradePath.path);
          const vulnPathString = getVulnPathString(
            pkgIssue.issueId,
            legacyFromPath,
          );
          upgradePathsMap[vulnPathString] = toLegacyUpgradePath(
            upgradePath.path,
          );
        }
      }
    }
  }

  // generate the legacy vulns array (vuln-data + metada per vulnerable path).
  //   use the upgradePathsMap to find available upgrade-paths
  const vulns: AnnotatedIssue[] = [];

  for (const pkgInfo of _.values(result.affectedPkgs)) {
    for (const vulnPkgPath of depGraph.pkgPathsToRoot(pkgInfo.pkg)) {
      const legacyFromPath = pkgPathToLegacyPath(vulnPkgPath.reverse());
      for (const pkgIssue of _.values(pkgInfo.issues)) {
        const vulnPathString = getVulnPathString(
          pkgIssue.issueId,
          legacyFromPath,
        );
        const upgradePath = upgradePathsMap[vulnPathString] || [];

        // TODO: we need the full issue-data for every path only for the --json output,
        //   consider picking only the required fields,
        //   and append the full data only for --json, to minimize chance of out-of-memory
        const annotatedIssue = Object.assign(
          {},
          result.issuesData[pkgIssue.issueId],
          {
            from: legacyFromPath,
            upgradePath,
            isUpgradable: !!upgradePath[0] || !!upgradePath[1],
            isPatchable: pkgIssue.fixInfo.isPatchable,
            name: pkgInfo.pkg.name,
            version: pkgInfo.pkg.version as string,
            nearestFixedInVersion: pkgIssue.fixInfo.nearestFixedInVersion,
          },
        ) as AnnotatedIssue & DockerIssue; // TODO(kyegupov): get rid of type assertion

        vulns.push(annotatedIssue);
      }
    }
  }

  const dockerRes = result.docker;

  if (dockerRes && dockerRes.binariesVulns) {
    const binariesVulns = dockerRes.binariesVulns;
    for (const pkgInfo of _.values(binariesVulns.affectedPkgs)) {
      for (const pkgIssue of _.values(pkgInfo.issues)) {
        const pkgAndVersion = (pkgInfo.pkg.name +
          '@' +
          pkgInfo.pkg.version) as string;
        const annotatedIssue = (Object.assign(
          {},
          binariesVulns.issuesData[pkgIssue.issueId],
          {
            from: ['Upstream', pkgAndVersion],
            upgradePath: [],
            isUpgradable: false,
            isPatchable: false,
            name: pkgInfo.pkg.name,
            version: pkgInfo.pkg.version as string,
            nearestFixedInVersion: pkgIssue.fixInfo.nearestFixedInVersion,
          },
        ) as any) as AnnotatedIssue; // TODO(kyegupov): get rid of forced type assertion
        vulns.push(annotatedIssue);
      }
    }
  }

  const meta = res.meta || {};

  severityThreshold =
    severityThreshold === SEVERITY.LOW ? undefined : severityThreshold;

  const legacyRes: LegacyVulnApiResult = {
    vulnerabilities: vulns,
    ok: vulns.length === 0,
    dependencyCount: depGraph.getPkgs().length - 1,
    org: meta.org,
    policy: meta.policy,
    isPrivate: !meta.isPublic,
    licensesPolicy: meta.licensesPolicy || null,
    packageManager,
    ignoreSettings: meta.ignoreSettings || null,
    docker: result.docker,
    summary: getSummary(vulns, severityThreshold),
    severityThreshold,
    remediation: result.remediation,
  };

  return legacyRes;
}

function getVulnPathString(issueId: string, vulnPath: string[]) {
  return issueId + '|' + JSON.stringify(vulnPath);
}

function pkgPathToLegacyPath(pkgPath: Pkg[]): string[] {
  return pkgPath.map(toLegacyPkgId);
}

function toLegacyUpgradePath(
  upgradePath: UpgradePathItem[],
): Array<string | boolean> {
  return upgradePath
    .filter((item) => !item.isDropped)
    .map((item) => {
      if (!item.newVersion) {
        return false;
      }

      return `${item.name}@${item.newVersion}`;
    });
}

function toLegacyPkgId(pkg: Pkg) {
  return `${pkg.name}@${pkg.version || '*'}`;
}

function getSummary(vulns: object[], severityThreshold?: SEVERITY): string {
  const count = vulns.length;
  let countText = '' + count;
  const severityFilters: string[] = [];
  const severitiesArray = SEVERITIES.map((s) => s.verboseName);
  if (severityThreshold) {
    severitiesArray
      .slice(severitiesArray.indexOf(severityThreshold))
      .forEach((sev) => {
        severityFilters.push(sev);
      });
  }

  if (!count) {
    if (severityFilters.length) {
      return `No ${severityFilters.join(' or ')} severity vulnerabilities`;
    }
    return 'No known vulnerabilities';
  }

  if (severityFilters.length) {
    countText += ' ' + severityFilters.join(' or ') + ' severity';
  }

  return `${countText} vulnerable dependency ${pl('path', count)}`;
}

function pl(word, count) {
  const ext = {
    y: 'ies',
    default: 's',
  };

  const last = word.split('').pop();

  if (count > 1) {
    return word.slice(0, -1) + (ext[last] || last + ext.default);
  }

  return word;
}

export { convertTestDepGraphResultToLegacy, AnnotatedIssue };
