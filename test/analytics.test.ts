import * as tap from 'tap';
import * as Proxyquire from 'proxyquire';
// tslint:disable-next-line
const osName = require('os-name');
import * as sinon from 'sinon';
import * as snyk from '../src/lib';
let old;
const iswindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;
const proxyquire = Proxyquire.noPreserveCache();
const { test } = tap;

tap.beforeEach((done) => {
  old = snyk.config.get('disable-analytics');
  snyk.config.delete('disable-analytics');
  done();
});

tap.afterEach((done) => {
  if (old === undefined) {
    snyk.config.delete('disable-analytics');
  } else {
    snyk.config.set('disable-analytics', old);
  }
  done();
});

test('analyticsAllowed returns false if disable-analytics set in snyk config', (t) => {
  t.plan(1);
  snyk.config.set('disable-analytics', '1');
  const analytics = require('../src/lib/analytics');
  const analyticsAllowed: boolean = analytics.allowAnalytics();
  t.notOk(analyticsAllowed);
});

test('analyticsAllowed returns true if disable-analytics is not set snyk config', (t) => {
  t.plan(1);
  const analytics = require('../src/lib/analytics');
  const analyticsAllowed: boolean = analytics.allowAnalytics();
  t.ok(analyticsAllowed);
});

test('analytics disabled', (t) => {
  const spy = sinon.spy();
  snyk.config.set('disable-analytics', '1');
  const analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  return analytics().then(() => {
    t.equal(spy.called, false, 'the request should not have been made');
  });
});

test('analytics', (t) => {
  const spy = sinon.spy();
  const analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  analytics.add('foo', 'bar');

  return analytics({
    command: '__test__',
    args: [],
  }).then(() => {
    const body = spy.lastCall.args[0].body.data;
    t.deepEqual(
      Object.keys(body).sort(),
      [
        'command',
        'os',
        'version',
        'id',
        'ci',
        'metadata',
        'args',
        'nodeVersion',
        'durationMs',
      ].sort(),
      'keys as expected',
    );

    const queryString = spy.lastCall.args[0].qs;
    t.deepEqual(queryString, undefined, 'query string is empty');
  });
});

test('analytics with args', (t) => {
  const spy = sinon.spy();
  const analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  analytics.add('foo', 'bar');

  return analytics({
    command: '__test__',
    args: [],
  }).then(() => {
    const body = spy.lastCall.args[0].body.data;
    t.deepEqual(
      Object.keys(body).sort(),
      [
        'command',
        'os',
        'version',
        'id',
        'ci',
        'metadata',
        'args',
        'nodeVersion',
        'durationMs',
      ].sort(),
      'keys as expected',
    );

    const queryString = spy.lastCall.args[0].qs;
    t.deepEqual(queryString, undefined, 'query string is empty');
  });
});

test('analytics with args and org', (t) => {
  const spy = sinon.spy();
  const analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  analytics.add('foo', 'bar');

  return analytics({
    command: '__test__',
    args: [],
    org: 'snyk',
  }).then(() => {
    const body = spy.lastCall.args[0].body.data;
    t.deepEqual(
      Object.keys(body).sort(),
      [
        'command',
        'os',
        'version',
        'id',
        'ci',
        'metadata',
        'args',
        'nodeVersion',
        'durationMs',
        'org',
      ].sort(),
      'keys as expected',
    );

    const queryString = spy.lastCall.args[0].qs;
    t.deepEqual(
      queryString,
      { org: 'snyk' },
      'query string has the expected values',
    );
  });
});

test('bad command', (t) => {
  const spy = sinon.spy();
  process.argv = ['node', 'script.js', 'random command', '-q'];
  const cli = proxyquire('../src/cli', {
    '../lib/analytics': proxyquire('../src/lib/analytics', {
      './request': spy,
    }),
  });

  return cli.then(() => {
    t.equal(spy.callCount, 1, 'analytics was called');

    const payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'bad-command', 'correct event name');
    t.equal(
      payload.data.metadata.command,
      'random command',
      'found original command',
    );
    t.equal(
      payload.data.metadata['error-message'],
      'Unknown command "random command"',
      'got correct error',
    );
  });
});

test('bad command with string error', (t) => {
  const spy = sinon.spy();
  process.argv = ['node', 'script.js', 'test', '-q'];
  const error = new Error('Some error') as any;
  error.code = 'CODE';
  const cli = proxyquire('../src/cli', {
    '../lib/analytics': proxyquire('../src/lib/analytics', {
      './request': spy,
    }),

    './args': proxyquire('../src/cli/args', {
      './commands': proxyquire('../src/cli/commands', {
        '../../lib/hotload': proxyquire('../src/lib/hotload', {
          // windows-based testing uses windows path separator
          '..\\cli\\commands\\test'() {
            return Promise.reject(error);
          },
          '../cli/commands/test'() {
            return Promise.reject(error);
          },
        }),
      }),
    }),
  });

  return cli.then(() => {
    t.equal(spy.callCount, 1, 'analytics was called');

    const payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'bad-command', 'correct event name');
    t.equal(payload.data.metadata.command, 'test', 'found original command');
    t.match(payload.data.metadata.error, 'Some error', 'got correct error');
  });
});

test('vulns found (thrown as an error)', (t) => {
  const spy = sinon.spy();
  process.argv = ['node', 'script.js', 'test', '-q'];
  const error = new Error('7 vulnerable dependency paths') as any;
  error.code = 'VULNS';
  const cli = proxyquire('../src/cli', {
    '../lib/analytics': proxyquire('../src/lib/analytics', {
      './request': spy,
    }),

    './args': proxyquire('../src/cli/args', {
      './commands': proxyquire('../src/cli/commands', {
        '../../lib/hotload': proxyquire('../src/lib/hotload', {
          // windows-based testing uses windows path separator
          '..\\cli\\commands\\test'() {
            return Promise.reject(error);
          },
          '../cli/commands/test'() {
            return Promise.reject(error);
          },
        }),
      }),
    }),
  });

  return cli.then(() => {
    t.equal(spy.callCount, 1, 'analytics was called');

    const payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'test', 'correct event name');
    t.equal(payload.data.metadata.command, 'test', 'found original command');
    t.equal(
      payload.data.metadata['error-message'],
      'Vulnerabilities found',
      'got correct vuln count',
    );
  });
});

test('test includes data', { skip: iswindows }, (t) => {
  const spy = sinon.spy();
  process.argv = ['node', 'script.js', 'test', 'snyk-demo-app', '-q'];

  const analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  const cli = proxyquire('../src/cli', {
    '../lib/analytics': analytics,
    './args': proxyquire('../src/cli/args', {
      './commands': proxyquire('../src/cli/commands', {
        '../../lib/hotload': proxyquire('../src/lib/hotload', {
          '../cli/commands/test': proxyquire('../src/lib/snyk-test', {
            './run-test': proxyquire('../src/lib/snyk-test/run-test', {
              '../analytics': analytics,
            }),
          }),
        }),
      }),
    }),
  });

  return cli.then(() => {
    t.equal(spy.callCount, 1, 'analytics was called');

    const payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'test', 'correct event name');
    t.equal(
      payload.data.metadata.package,
      'snyk-demo-app@*',
      'includes package',
    );
  });
});
