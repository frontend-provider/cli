import * as analytics from '../../../../../src/lib/analytics';
import * as request from '../../../../../src/lib/request';
import { argsFrom } from './utils';
import * as apiTokenModule from '../../../../../src/lib/api-token';

describe('analytics module', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends anaytics with no token set', async () => {
    analytics.add('k1', 'v1');
    const requestSpy = jest.spyOn(request, 'makeRequest');
    requestSpy.mockResolvedValue();

    const someTokenExistsSpy = jest.spyOn(apiTokenModule, 'someTokenExists');
    someTokenExistsSpy.mockReturnValue(false);

    await analytics.addDataAndSend({
      args: argsFrom({}),
    });

    expect(requestSpy).toBeCalledTimes(1);
    expect(requestSpy.mock.calls[0][0]).not.toHaveProperty(
      'headers.authorization',
    );
  });

  it('ignores analytics request failures', async () => {
    const requestSpy = jest.spyOn(request, 'makeRequest');
    requestSpy.mockRejectedValue(new Error('this should be ignored'));

    const result = analytics.addDataAndSend({
      args: argsFrom({}),
    });

    await expect(result).resolves.toBeUndefined();
  });

  it('adds a value to the current analytics metadata', async () => {
    const requestSpy = jest.spyOn(request, 'makeRequest');
    requestSpy.mockResolvedValue();

    analytics.add('k2', 2);
    analytics.add('k3', { test: 'test' });
    analytics.add('k1', 'v2');
    analytics.add('k1', ['v3', 'v4']);
    analytics.add('k1', 5);
    analytics.add('k2', 4);
    analytics.add('k3', { test: 'test' });

    await analytics.addDataAndSend({
      args: argsFrom({}),
    });

    expect(requestSpy.mock.calls[0][0].body.data).toHaveProperty('metadata', {
      k1: ['v1', 'v2', 'v3', 'v4', 5], //v1 was added in the 1st test
      k2: 6,
      k3: [{ test: 'test' }, { test: 'test' }],
    });
  });
});
