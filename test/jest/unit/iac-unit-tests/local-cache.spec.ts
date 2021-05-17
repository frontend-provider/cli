import * as localCacheModule from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import { FailedToInitLocalCacheError } from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import { PassThrough } from 'stream';
import * as needle from 'needle';
import * as rimraf from 'rimraf';
import * as fs from 'fs';
import * as path from 'path';

describe('initLocalCache - downloads bundle successfully', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
  });

  it('downloads and extracts the bundle successfully', async () => {
    const mockReadable = fs.createReadStream(
      path.join(__dirname, '../../../fixtures/iac/custom-rules/custom.tar.gz'),
    );
    const spy = jest
      .spyOn(fileUtilsModule, 'extractBundle')
      .mockResolvedValue();
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest.spyOn(needle, 'get').mockReturnValue(mockReadable);

    await localCacheModule.initLocalCache();

    expect(needle.get).toHaveBeenCalledWith(
      expect.stringContaining('bundle.tar.gz'),
    );
    expect(spy).toHaveBeenCalledWith(mockReadable);
  });

  it('extracts the custom rules', async () => {
    const mockReadable = fs.createReadStream(
      path.join(__dirname, '../../../fixtures/iac/custom-rules/custom.tar.gz'),
    );
    const spy = jest
      .spyOn(fileUtilsModule, 'extractBundle')
      .mockResolvedValue();
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest.spyOn(needle, 'get').mockReturnValue(new PassThrough());
    jest.spyOn(fs, 'createReadStream').mockReturnValue(mockReadable);

    await localCacheModule.initLocalCache({
      customRulesPath: './path/to/custom.tar.gz',
    });

    expect(fs.createReadStream).toHaveBeenCalledWith('./path/to/custom.tar.gz');
    expect(spy).toHaveBeenCalledWith(mockReadable);
  });

  it('cleans up the custom folder after finishes', () => {
    const iacPath: fs.PathLike = path.join(`${process.cwd()}`, '.iac-data');
    const spy = jest.spyOn(rimraf, 'sync');

    localCacheModule.cleanLocalCache();

    expect(spy).toHaveBeenCalledWith(iacPath);
    jest.restoreAllMocks();
    expect(fs.existsSync(iacPath)).toBeFalsy();
  });
});

describe('initLocalCache - errors', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
  });

  it('throws an error on creation of cache dir', async () => {
    const error = new Error(
      'The .iac-data directory can not be created. ' +
        'Please make sure that the current working directory has write permissions',
    );
    jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => {
      throw error;
    });

    const promise = localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
    await expect(promise).rejects.toThrow(FailedToInitLocalCacheError);
  });
});
