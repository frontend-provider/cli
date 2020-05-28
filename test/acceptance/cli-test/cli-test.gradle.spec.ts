import * as sinon from 'sinon';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { AcceptanceTests } from './cli-test.acceptance.test';
import { CommandResult } from '../../../src/cli/commands/types';

export const GradleTests: AcceptanceTests = {
  language: 'Gradle',
  tests: {
    '`test gradle-kotlin-dsl-app` returns correct meta': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: { name: 'testplugin', runtime: 'testruntime' },
          };
        },
      };
      sinon.spy(plugin, 'inspect');
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);

      const commandResult: CommandResult = await params.cli.test(
        'gradle-kotlin-dsl-app',
      );
      const res: string = commandResult.getDisplayResults();
      const meta = res.slice(res.indexOf('Organization:')).split('\n');
      t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
      t.match(
        meta[1],
        /Package manager:\s+gradle/,
        'package manager displayed',
      );
      t.match(
        meta[2],
        /Target file:\s+build.gradle.kts/,
        'target file displayed',
      );
      t.match(meta[3], /Open source:\s+no/, 'open source displayed');
      t.match(
        meta[4],
        /Project path:\s+gradle-kotlin-dsl-app/,
        'path displayed',
      );
      t.notMatch(
        meta[5],
        /Local Snyk policy:\s+found/,
        'local policy not displayed',
      );
    },

    '`test gradle-app` returns correct meta': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: { name: 'testplugin', runtime: 'testruntime' },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);

      const commandResult: CommandResult = await params.cli.test('gradle-app');
      const res = commandResult.getDisplayResults();
      const meta = res.slice(res.indexOf('Organization:')).split('\n');

      t.false(
        ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
        '`allSubProjects` option is not sent',
      );
      t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
      t.match(
        meta[1],
        /Package manager:\s+gradle/,
        'package manager displayed',
      );
      t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
      t.match(meta[3], /Open source:\s+no/, 'open source displayed');
      t.match(meta[4], /Project path:\s+gradle-app/, 'path displayed');
      t.notMatch(
        meta[5],
        /Local Snyk policy:\s+found/,
        'local policy not displayed',
      );
    },

    '`test gradle-app --all-sub-projects` sends `allSubProjects` argument to plugin': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return { plugin: { name: 'gradle' }, package: {} };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);

      await params.cli.test('gradle-app', {
        allSubProjects: true,
      });
      t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);
    },

    '`test gradle-app` plugin fails to return package or scannedProjects': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return { plugin: { name: 'gradle' } };
        },
      };
      sinon.spy(plugin, 'inspect');
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);

      try {
        await params.cli.test('gradle-app', {});
        t.fail('expected error');
      } catch (error) {
        t.match(
          error,
          /error getting dependencies from gradle plugin: neither 'package' nor 'scannedProjects' were found/,
          'error found',
        );
      }
    },

    '`test gradle-app --all-sub-projects` returns correct multi tree meta': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect(): Promise<pluginApi.MultiProjectResult> {
          return {
            plugin: { name: 'gradle' },
            scannedProjects: [
              {
                depTree: {
                  name: 'tree0',
                  version: '1.0.0',
                  dependencies: { dep1: { name: 'dep1', version: '1' } },
                },
              },
              {
                depTree: {
                  name: 'tree1',
                  version: '2.0.0',
                  dependencies: { dep1: { name: 'dep2', version: '2' } },
                },
              },
            ],
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);

      const commandResult: CommandResult = await params.cli.test('gradle-app', {
        allSubProjects: true,
      });
      const res = commandResult.getDisplayResults();
      t.true(
        ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
        '`allSubProjects` option is sent',
      );

      const tests = res
        .split('Testing gradle-app...')
        .filter((s) => !!s.trim());
      t.equals(tests.length, 2, 'two projects tested independently');
      t.match(
        res,
        /Tested 2 projects/,
        'number projects tested displayed properly',
      );
      for (let i = 0; i < tests.length; i++) {
        const meta = tests[i]
          .slice(tests[i].indexOf('Organization:'))
          .split('\n');
        t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
        t.match(
          meta[1],
          /Package manager:\s+gradle/,
          'package manager displayed',
        );
        t.match(
          meta[2],
          /Target file:\s+build.gradle/,
          'target file displayed',
        );
        t.match(meta[3], /Project name:\s+tree/, 'sub-project displayed');
        t.includes(meta[3], `tree${i}`, 'sub-project displayed');
        t.match(meta[4], /Open source:\s+no/, 'open source displayed');
        t.match(meta[5], /Project path:\s+gradle-app/, 'path displayed');
        t.notMatch(
          meta[6],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },
  },
};
