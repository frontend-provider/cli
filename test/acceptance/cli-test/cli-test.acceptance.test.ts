import * as tap from 'tap';
import * as cli from '../../../src/cli/commands';
import { fakeServer } from '../fake-server';
import * as version from '../../../src/lib/version';
import { chdirWorkspaces } from '../workspace-helper';

export interface AcceptanceTests {
  language: string;
  tests: {
    [name: string]: any;
  };
}

import { GenericTests } from './cli-test.generic.spec';

import { CocoapodsTests } from './cli-test.cocoapods.spec';
import { ComposerTests } from './cli-test.composer.spec';
import { DockerTests } from './cli-test.docker.spec';
import { GoTests } from './cli-test.go.spec';
import { GradleTests } from './cli-test.gradle.spec';
import { MavenTests } from './cli-test.maven.spec';
import { NpmTests } from './cli-test.npm.spec';
import { NugetTests } from './cli-test.nuget.spec';
import { PythonTests } from './cli-test.python.spec';
import { RubyTests } from './cli-test.ruby.spec';
import { SbtTests } from './cli-test.sbt.spec';
import { YarnTests } from './cli-test.yarn.spec';
import { AllProjectsTests } from './cli-test.all-projects.spec';

const languageTests: AcceptanceTests[] = [
  CocoapodsTests,
  ComposerTests,
  DockerTests,
  GoTests,
  GradleTests,
  MavenTests,
  NpmTests,
  NugetTests,
  PythonTests,
  RubyTests,
  SbtTests,
  YarnTests,
];

const { test, only } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
const apiKey = '123456789';
let oldkey;
let oldendpoint;
let versionNumber;
const server = fakeServer(process.env.SNYK_API, apiKey);
const before = tap.runOnly ? only : test;
const after = tap.runOnly ? only : test;

// Should be after `process.env` setup.
import * as plugins from '../../../src/lib/plugins/index';

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('setup', async (t) => {
  versionNumber = await version();

  t.plan(3);
  let key = await cli.config('get', 'api');
  oldkey = key;
  t.pass('existing user config captured');

  key = await cli.config('get', 'endpoint');
  oldendpoint = key;
  t.pass('existing user endpoint captured');

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });
  t.pass('started demo server');
  t.end();
});

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('prime config', async (t) => {
  await cli.config('set', 'api=' + apiKey);
  t.pass('api token set');
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');
  t.end();
});

test(GenericTests.language, async (t) => {
  for (const testName of Object.keys(GenericTests.tests)) {
    t.test(
      testName,
      GenericTests.tests[testName](
        { server, versionNumber, cli },
        { chdirWorkspaces },
      ),
    );
  }
});

test(AllProjectsTests.language, async (t) => {
  for (const testName of Object.keys(AllProjectsTests.tests)) {
    t.test(
      testName,
      AllProjectsTests.tests[testName](
        { server, versionNumber, cli, plugins },
        { chdirWorkspaces },
      ),
    );
  }
});

test('Languages', async (t) => {
  for (const languageTest of languageTests) {
    t.test(languageTest.language, async (tt) => {
      for (const testName of Object.keys(languageTest.tests)) {
        tt.test(
          testName,
          languageTest.tests[testName](
            { server, plugins, versionNumber, cli },
            { chdirWorkspaces },
          ),
        );
      }
    });
  }
});

// @later: try and remove this config stuff
// Was copied straight from ../src/cli-server.js
after('teardown', async (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  await new Promise((resolve) => {
    server.close(resolve);
  });
  t.pass('server shutdown');
  let key = 'set';
  let value = 'api=' + oldkey;
  if (!oldkey) {
    key = 'unset';
    value = 'api';
  }
  await cli.config(key, value);
  t.pass('user config restored');
  if (oldendpoint) {
    await cli.config('endpoint', oldendpoint);
    t.pass('user endpoint restored');
    t.end();
  } else {
    t.pass('no endpoint');
    t.end();
  }
});
