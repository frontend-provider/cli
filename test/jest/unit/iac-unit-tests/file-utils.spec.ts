import { extractBundle } from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import * as tar from 'tar';
import { PassThrough } from 'stream';

describe('extractBundle', () => {
  jest.mock('fs');

  it('fails to write the file on disk', async () => {
    const mockReadable = new PassThrough();
    const mockError = new Error('A stream error');

    const actualPromise = extractBundle(mockReadable);
    mockReadable.emit('error', mockError);

    await expect(actualPromise).rejects.toThrow(mockError);
  });

  it('resolves data successfully', async () => {
    const tarSpy = jest.spyOn(tar, 'x');

    let receivedBundleData = '';
    const mockUntarStream = new PassThrough();
    mockUntarStream.on('data', (evt) => (receivedBundleData += evt.toString()));
    tarSpy.mockReturnValueOnce(mockUntarStream);

    const mockBundleStream = new PassThrough();
    const extractBundlePromise = extractBundle(mockBundleStream);
    mockBundleStream.write('zipped data');
    mockBundleStream.end();

    await expect(extractBundlePromise).resolves.toEqual(undefined);
    expect(tarSpy).toBeCalledWith({ C: expect.stringMatching('.iac-data') });
    expect(receivedBundleData).toEqual('zipped data');
  });
});
