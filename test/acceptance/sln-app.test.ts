import {test} from 'tap';
import * as path from 'path';
import * as sln from '../../src/lib/sln';

test('parseFoldersFromSln when passed an existent filename', (t) => {
  const slnFile = 'test/acceptance/workspaces/sln-example-app/mySolution.sln';
  const expected = JSON.stringify([
    'dotnet2_new_mvc_project/new_mvc_project.csproj',
    'WebApplication2/WebApplication2.csproj',
  ]);
  const actual = JSON.stringify(sln.parsePathsFromSln(slnFile));
  t.equal(actual, expected, 'should parse & extract csproj folders');
  t.end();
});

test('parseFoldersFromSln when non existent filename', (t) => {
  let response;
  const slnFile = 'test/acceptance/workspaces/sln-example-app/mySolution1.sln';
  try {
    response = sln.parsePathsFromSln(slnFile);
    t.fail('an exception should be thrown');
  } catch (e) {
    t.match(e.message, 'File not found: ', 'should throw exception');
    t.equal(response, undefined, 'shouldnt return');
  }
  t.end();
});

test('parseFoldersFromSln when no supported files found', (t) => {
  let response;
  const slnFile = 'test/acceptance/workspaces/sln-no-supported-files/mySolution1.sln';
  try {
    response = sln.parsePathsFromSln(slnFile);
    t.fail('an exception should be thrown');
  } catch (e) {
    t.match(e.message, 'File not found: ', 'should throw exception');
    t.equal(response, undefined, 'shouldnt return');
  }
  t.end();
});

test('sln.updateArgs for existing sln with regular paths', (t) => {
  const args = {options: {
    file: 'test/acceptance/workspaces/sln-example-app/mySolution.sln', _: []}};

  sln.updateArgs(args);
  t.notOk(args.options.file, '`file` option is removed');
  args.options._.pop();
  t.same(args.options._.map((r) => path.basename(r)),
    [ 'dotnet2_new_mvc_project', 'WebApplication2' ], 'args should be added');
  t.end();
});

test('sln.updateArgs for existing sln with relative paths', (t) => {
  const args = {options: {
    file: 'test/acceptance/workspaces/slnSolution.sln', _: []}};

  sln.updateArgs(args);
  t.notOk(args.options.file, '`file` option is removed');
  args.options._.pop();
  t.same(args.options._.map((r) => path.basename(r)),
    [  'nuget-app', 'nuget-app-2.1'], 'args should be added');
  t.end();
});

test('sln.updateArgs for sln with no relevant projects', (t) => {
  const args = {options: {
    file: 'test/acceptance/workspaces/emptySolution.sln', _: []}};

  try {
    sln.updateArgs(args);
    t.fail('should have exploded');
  } catch (e) {
    t.equal(e.message, 'No relevant projects found in Solution',
      'Error thrown on solution with no valid projects');
  }
  t.end();
});

test('sln.updateArgs for sln without --file', (t) => {
  const args = {options: {
    'test/acceptance/workspaces/emptySolution.sln': ''}};

  try {
    sln.updateArgs(args);
    t.fail('should have exploded');
  } catch (e) {
    t.equal(e.message, 'No relevant projects found in Solution',
      'Error thrown on solution with no valid projects');
  }
  t.end();
});

test('sln.updateArgs for non-existing sln', (t) => {
  const args = {options: {file: 'non_existent', _: []}};

  try {
    sln.updateArgs(args);
    t.fail('should have exploded');
  } catch (e) {
    t.equal(args.options.file, 'non_existent', 'file parameter should remain');
    t.equal(args.options._.length, 0, 'params not added');
  }
  t.end();
});
