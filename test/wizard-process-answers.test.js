var tap = require('tap');
var test = require('tap').test;
var proxyquire = require('proxyquire');
var path = require('path');
var sinon = require('sinon');
var noop = function () {};
var snyk = require('../src/lib');

// spies
var policySaveSpy;
var execSpy;
var writeSpy;

// policy
var save = p => {
  policySaveSpy(p);
  return Promise.resolve();
};

snyk.policy.save = function (data) {
  policySaveSpy(data);
  return Promise.resolve();
};

var policy = proxyquire('snyk-policy', { save: save });
var mockPolicy;

tap.beforeEach(done => {
  // reset all spies
  policySaveSpy = sinon.spy();
  execSpy = sinon.spy();
  writeSpy = sinon.spy();

  policy.create().then(p => {
    mockPolicy = p;
    mockPolicy.save = save.bind(null, mockPolicy);
  }).then(done);
});

// proxies
var getVulnSource = proxyquire('../src/lib/protect/get-vuln-source', {
  'fs': {
    statSync: function () {
      return true;
    }
  },
});

var thenfs = {
  writeFile: function (filename, body) {
    writeSpy(filename, body);
    return Promise.resolve();
  },
  createWriteStream: function () {
    // fake event emitter (sort of)
    return {
      on: noop,
      end: noop,
      removeListener: noop,
      emit: noop,
    };
  },
};

var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  '../../../lib/npm': function (cmd) {
    execSpy(cmd);
    return Promise.resolve(true);
  },
  'then-fs': thenfs,
  '../../../src/lib/protect': proxyquire('../src/lib/protect', {
    'fs': {
      statSync: function () {
        return true;
      }
    },
    './get-vuln-source': getVulnSource,
    './patch': proxyquire('../src/lib/protect/patch', {
      './write-patch-flag': proxyquire('../src/lib/protect/write-patch-flag', {
        'then-fs': thenfs,
      }),
      './get-vuln-source': getVulnSource,
      'then-fs': thenfs,
      './apply-patch': proxyquire('../src/lib/protect/apply-patch', {
        'child_process': {
          exec: function (a, b, callback) {
            callback(null, '', ''); // successful patch
          }
        }
      })
    }),
    './update': proxyquire('../src/lib/protect/update', {
      '../npm': function (cmd, packages, live, cwd, flags) {
        execSpy(cmd, packages, live, cwd, flags);
        return Promise.resolve(true);
      },
    }),
  }),
});


test('pre-tarred packages can be patched', function (t) {
  var answers = require(__dirname + '/fixtures/forever-answers.json');

  wizard.processAnswers(answers, mockPolicy).then(function () {
    t.equal(policySaveSpy.callCount, 1, 'write functon was only called once');
    var vulns = Object.keys(policySaveSpy.args[0][0].patch);
    var expect = Object.keys(answers).filter(function (key) {
      return key.slice(0, 5) !== 'misc-';
    }).map(function (key) {
      return answers[key].vuln.id;
    });
    t.deepEqual(vulns, expect, 'two patches included');
  }).catch(t.threw).then(t.end);
});

test('process answers handles shrinkwrap', function (t) {
  t.plan(2);

  t.test('non-shrinkwrap package', function (t) {
    execSpy = sinon.spy();
    var answers = require(__dirname + '/fixtures/forever-answers.json');
    answers['misc-test-no-monitor'] = true;
    wizard.processAnswers(answers, mockPolicy).then(function () {
      t.equal(execSpy.callCount, 0, 'shrinkwrap was not called');
    }).catch(t.threw).then(t.end);
  });

  t.test('shrinkwraped package', function (t) {
    execSpy = sinon.spy();
    var cwd = process.cwd();
    process.chdir(__dirname + '/fixtures/pkg-mean-io/');
    var answers = require(__dirname + '/fixtures/mean-answers.json');
    answers['misc-test-no-monitor'] = true;
    wizard.processAnswers(answers, mockPolicy).then(function () {
      var shrinkCall = execSpy.getCall(2); // get the 2nd call (as the first is the install of snyk)
      t.equal(shrinkCall.args[0], 'shrinkwrap', 'shrinkwrap was called');
      process.chdir(cwd);
    }).catch(t.threw).then(t.end);

  });
});

test('wizard updates vulns without changing dep type', function (t) {
  execSpy = sinon.spy();
  var cwd = process.cwd();
  process.chdir(__dirname + '/fixtures/pkg-SC-1472/');
  var answers = require(__dirname + '/fixtures/SC-1472.json');
  answers['misc-test-no-monitor'] = true;
  wizard.processAnswers(answers, mockPolicy).then(function () {
    t.equal(execSpy.callCount, 3, 'uninstall, install prod, install dev');
    t.equal(execSpy.getCall(1).args[1].length, 1, '1 prod dep');
    t.equal(execSpy.getCall(1).args[1].length, 1, '2 dev dep');
    process.chdir(cwd);
  }).catch(t.threw).then(t.end);
});

test('wizard replaces npm\s default scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'no-deps');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, 'snyk test', 'default npm exit 1 was replaced');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});

test('wizard replaces prepends to scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'demo-os');
  var prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, 'snyk test && ' + prevPkg.scripts.test, 'prepended to test script');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});

test('wizard detects existing snyk in scripts.test', function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'pkg-mean-io');
  var prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy).then(function () {
    t.equal(writeSpy.callCount, 1, 'package was written to');
    var pkg = JSON.parse(writeSpy.args[0][1]);
    t.equal(pkg.scripts.test, prevPkg.scripts.test, 'test script untouched');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});

test('wizard maintains whitespace at beginning and end of package.json',
     function (t) {
  var old = process.cwd();
  var dir = path.resolve(__dirname, 'fixtures', 'pkg-mean-io');
  var prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy, {
    packageLeading: '\n',
    packageTrailing: '\n\n',
  }).then(function () {
    var pkgString = writeSpy.args[0][1];
    t.equal(pkgString.substr(0, 2), '\n{',
            'newline at beginning of file');
    t.equal(pkgString.substr(pkgString.length - 3), '}\n\n',
            'two newlines at end of file');
  }).catch(t.threw).then(function () {
    process.chdir(old);
    t.end();
  });
});
