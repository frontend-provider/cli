import * as Sarif from 'sarif';
import * as Debug from 'debug';
import chalk from 'chalk';
import { getLegacySeveritiesColour, SEVERITY } from '../../../snyk-test/common';
import { rightPadWithSpaces } from '../../../right-pad';
import { Options } from '../../../types';

const debug = Debug('code-output');

export function getCodeDisplayedOutput(
  codeTest: Sarif.Log,
  meta: string,
  prefix: string,
): string {
  let issues: { [index: string]: string[] } = {};

  if (codeTest.runs[0].results) {
    const results: Sarif.Result[] = codeTest.runs[0].results;

    const rulesMap: {
      [ruleId: string]: Sarif.ReportingDescriptor;
    } = getRulesMap(codeTest.runs[0].tool.driver.rules || []);

    issues = getIssues(results, rulesMap);
  }

  const issuesText =
    issues.low.join('') + issues.medium.join('') + issues.high.join('');
  const summaryOKText = chalk.green('✔ Test completed');
  const codeIssueSummary = getCodeIssuesSummary(issues);

  return (
    prefix +
    issuesText +
    '\n' +
    summaryOKText +
    '\n\n' +
    meta +
    '\n\n' +
    codeIssueSummary
  );
}

function getCodeIssuesSummary(issues: { [index: string]: string[] }): string {
  const lowSeverityText = issues.low.length
    ? getLegacySeveritiesColour(SEVERITY.LOW).colorFunc(
        ` ${issues.low.length} [Low] `,
      )
    : '';
  const mediumSeverityText = issues.medium.length
    ? getLegacySeveritiesColour(SEVERITY.MEDIUM).colorFunc(
        ` ${issues.medium.length} [Medium] `,
      )
    : '';
  const highSeverityText = issues.high.length
    ? getLegacySeveritiesColour(SEVERITY.HIGH).colorFunc(
        `${issues.high.length} [High] `,
      )
    : '';

  const codeIssueCount =
    issues.low.length + issues.medium.length + issues.high.length;
  const codeIssueFound = `${codeIssueCount} Code issue${
    codeIssueCount > 0 ? 's' : ''
  } found`;
  const issuesBySeverityText =
    highSeverityText + mediumSeverityText + lowSeverityText;
  const vulnPathsText = chalk.green('✔ Awesome! No issues were found.');

  return codeIssueCount > 0
    ? codeIssueFound + '\n' + issuesBySeverityText
    : vulnPathsText;
}

function getIssues(
  results: Sarif.Result[],
  rulesMap: { [ruleId: string]: Sarif.ReportingDescriptor },
): { [index: string]: string[] } {
  const issuesInit: { [index: string]: string[] } = {
    low: [],
    medium: [],
    high: [],
  };

  const issues = results.reduce((acc, res) => {
    if (res.locations?.length) {
      const location = res.locations[0].physicalLocation;
      if (res.level && location?.artifactLocation && location?.region) {
        const severity = sarifToSeverityLevel(res.level);
        const ruleId = res.ruleId!;
        if (!(ruleId in rulesMap)) {
          debug('Rule ID does not exist in the rules list');
        }
        const ruleName =
          rulesMap[ruleId].shortDescription?.text || rulesMap[ruleId].name;
        const ruleIdSeverityText = getLegacySeveritiesColour(
          severity.toLowerCase(),
        ).colorFunc(` ✗ [${severity}] ${ruleName}`);
        const artifactLocationUri = location.artifactLocation.uri;
        const startLine = location.region.startLine;
        const text = res.message.text;

        const title = ruleIdSeverityText;
        const path = `    Path: ${artifactLocationUri}, line ${startLine}`;
        const info = `    Info: ${text}`;
        acc[severity.toLowerCase()].push(`${title} \n ${path} \n ${info}\n\n`);
      }
    }
    return acc;
  }, issuesInit);

  return issues;
}

function getRulesMap(
  rules: Sarif.ReportingDescriptor[],
): { [ruleId: string]: Sarif.ReportingDescriptor } {
  const rulesMapByID = rules.reduce((acc, rule) => {
    acc[rule.id] = rule;
    return acc;
  }, {});

  return rulesMapByID;
}

function sarifToSeverityLevel(
  sarifConfigurationLevel: Sarif.ReportingConfiguration.level,
): string {
  const severityLevel = {
    note: 'Low',
    warning: 'Medium',
    error: 'High',
  };

  return severityLevel[sarifConfigurationLevel] as string;
}

export function getMeta(options: Options, path: string): string {
  const padToLength = 19; // chars to align
  const orgName = options.org;
  const projectPath = options.path || path;
  const meta = [
    chalk.bold(rightPadWithSpaces('Organization: ', padToLength)) + orgName,
  ];
  meta.push(
    chalk.bold(rightPadWithSpaces('Test type: ', padToLength)) +
      'Static code analysis',
  );
  meta.push(
    chalk.bold(rightPadWithSpaces('Project path: ', padToLength)) + projectPath,
  );

  return meta.join('\n');
}

export function getPrefix(path: string): string {
  return chalk.bold.white('\nTesting ' + path + ' ...\n\n');
}
