import {
  getContributors,
  getTimestampStartOfContributingDevTimeframe,
  execShell,
  SERIOUS_DELIMITER,
  MAX_COMMITS_IN_GIT_LOG,
  separateLines,
  hashData,
} from '../src/lib/monitor/dev-count-analysis';

const testTimeout = 60000;

const TIMESTAMP_TO_TEST = 1590174610000;

describe('cli dev count via git log analysis', () => {
  let expectedContributorUserIds: string[] = [];
  let expectedMergeOnlyUserIds: string[] = [];

  // this computes the expectedContributorUserIds and expectedMergeOnlyUserIds
  beforeAll(async () => {
    const timestampEpochSecondsEndOfPeriod = Math.floor(
      TIMESTAMP_TO_TEST / 1000,
    );
    const timestampEpochSecondsStartOfPeriod = getTimestampStartOfContributingDevTimeframe(
      new Date(TIMESTAMP_TO_TEST),
      10,
    );

    const withMergesGitLogCommand = `git --no-pager log --pretty=tformat:"%H${SERIOUS_DELIMITER}%an${SERIOUS_DELIMITER}%ae${SERIOUS_DELIMITER}%aI${SERIOUS_DELIMITER}%s" --after="${timestampEpochSecondsStartOfPeriod}" --until="${timestampEpochSecondsEndOfPeriod}" --max-count=${MAX_COMMITS_IN_GIT_LOG}`;
    const withMergesGitLogStdout: string = await execShell(
      withMergesGitLogCommand,
      process.cwd(),
    );
    const withMergesLogLines = separateLines(withMergesGitLogStdout);
    const allEmails = withMergesLogLines.map(
      (l) => l.split(SERIOUS_DELIMITER)[2], // index 2 corresponds to %ae% which is the author email
    );
    const uniqueEmails = [...new Set(allEmails)]; // dedupe the list of emails

    const uniqueEmailsContainingOnlyMergeCommits: string[] = []; // a list of emails which are only associated with merge commits; don't include an email if it also have regular commits
    const uniqueEmailsContainingAtLeastOneNonMergeCommit: string[] = [];
    for (const nextEmail of uniqueEmails) {
      const associatedCommits = withMergesLogLines.filter((l) =>
        l.includes(nextEmail),
      );
      const allAssociatedCommitsAreMergeCommits = associatedCommits.every((e) =>
        e.includes('Merge pull request'),
      );
      if (allAssociatedCommitsAreMergeCommits) {
        uniqueEmailsContainingOnlyMergeCommits.push(nextEmail);
      } else {
        uniqueEmailsContainingAtLeastOneNonMergeCommit.push(nextEmail);
      }
    }

    expectedContributorUserIds = uniqueEmailsContainingAtLeastOneNonMergeCommit.map(
      hashData,
    );
    expectedMergeOnlyUserIds = uniqueEmailsContainingOnlyMergeCommits.map(
      hashData,
    );
  }, testTimeout);

  it(
    'returns contributors',
    async () => {
      const contributors = await getContributors({
        endDate: new Date(TIMESTAMP_TO_TEST),
        periodDays: 10,
        repoPath: process.cwd(),
      });
      const contributorUserIds = contributors.map((c) => c.userId);
      expect(contributorUserIds.sort()).toEqual(
        expectedContributorUserIds.sort(),
      );
    },
    testTimeout,
  );

  it(
    'does not include contributors who have only merged pull requests',
    async () => {
      const contributors = await getContributors({
        endDate: new Date(TIMESTAMP_TO_TEST),
        periodDays: 10,
        repoPath: process.cwd(),
      });
      const contributorUserIds = contributors.map((c) => c.userId);

      // make sure none of uniqueEmailsContainingOnlyMergeCommits are in contributorUserIds
      const legitUserIdsWhichAreAlsoInMergeOnlyUserIds = expectedMergeOnlyUserIds.filter(
        (user) => contributorUserIds.includes(user),
      );
      expect(legitUserIdsWhichAreAlsoInMergeOnlyUserIds).toHaveLength(0);
    },
    testTimeout,
  );
});
