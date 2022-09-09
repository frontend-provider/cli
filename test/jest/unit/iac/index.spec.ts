jest.mock('../../../../src/cli/commands/test/iac/local-execution/local-cache');
jest.mock('../../../../src/cli/commands/test/iac/local-execution/file-loader');
const parseFilesStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/file-parser',
  () => {
    return {
      parseFiles: parseFilesStub,
    };
  },
);
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/file-scanner',
  () => {
    return {
      scanFiles: async () => {
        return {
          scannedFiles: [],
          failedScans: [],
        };
      },
    };
  },
);
jest.mock('../../../../src/lib/detect', () => ({
  isLocalFolder: () => true,
}));

const getIacOrgSettingsStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/org-settings/get-iac-org-settings.ts',
  () => ({
    getIacOrgSettings: getIacOrgSettingsStub,
  }),
);

const getAllDirectoriesForPathStub = jest.fn();
const getFilesForDirectoryStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/directory-loader',
  () => ({
    getAllDirectoriesForPath: getAllDirectoriesForPathStub,
    getFilesForDirectory: getFilesForDirectoryStub,
  }),
);

import { test } from '../../../../src/cli/commands/test/iac/local-execution/';
import {
  EngineType,
  IacFileParsed,
  IaCTestFlags,
  RulesOrigin,
} from '../../../../src/cli/commands/test/iac/local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

import { SingleGroupResultsProcessor } from '../../../../src/cli/commands/test/iac/local-execution/process-results';
const parsedFiles: IacFileParsed[] = [
  {
    engineType: EngineType.Terraform,
    fileContent: 'FAKE_FILE_CONTENT',
    jsonContent: {},
    filePath: './storage/storage.tf',
    fileType: 'tf',
    projectType: IacProjectType.TERRAFORM,
  },
];
const failedFiles: IacFileParsed[] = [
  {
    engineType: EngineType.Terraform,
    fileContent: 'FAKE_FILE_CONTENT',
    jsonContent: {},
    filePath: './storage/storage.tf',
    fileType: 'tf',
    failureReason: 'Mock Test',
    projectType: IacProjectType.TERRAFORM,
  },
];

describe('test()', () => {
  describe('parsing', () => {
    const iacOrgSettings = {
      meta: {
        isPrivate: false,
        isLicensesEnabled: false,
        ignoreSettings: null,
        org: 'org-name',
        orgPublicId: '7bfa4159-6f90-4acd-82a4-0b2ad2aaf80b',
      },
      customPolicies: {},
      customRules: {},
      entitlements: {
        infrastructureAsCode: true,
        iacCustomRulesEntitlement: true,
      },
    };

    beforeAll(() => {
      getAllDirectoriesForPathStub.mockImplementation(() => ['./storage']);
      parseFilesStub.mockImplementation(() => ({
        parsedFiles,
        failedFiles,
      }));
      getIacOrgSettingsStub.mockImplementation(async () => iacOrgSettings);
    });

    it('returns the unparsable files excluding content', async () => {
      const opts: IaCTestFlags = {};

      const resultsProcessor = new SingleGroupResultsProcessor(
        './storage/',
        'org-name',
        iacOrgSettings,
        opts,
        {
          projectName: 'project-name',
          orgName: 'org-name',
        },
      );

      const { failures } = await test(
        resultsProcessor,
        './storage/',
        opts,
        iacOrgSettings,
        RulesOrigin.Internal,
      );

      expect(failures).toEqual([
        {
          filePath: './storage/storage.tf',
          fileType: 'tf',
          failureReason: 'Mock Test',
          projectType: IacProjectType.TERRAFORM,
        },
      ]);
      expect(failures).not.toEqual(
        expect.arrayContaining([
          {
            fileContent: 'FAKE_FILE_CONTENT',
            jsonContent: {},
          },
        ]),
      );
    });
  });
});
