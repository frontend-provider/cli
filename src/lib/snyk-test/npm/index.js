module.exports = test;

var debug = require('debug')('snyk');
var request = require('../../request');
var path = require('path');
var fs = require('then-fs');
var snyk = require('../..');
var spinner = require('../../spinner');
var moduleToObject = require('snyk-module');
var isCI = require('../../is-ci');
var _ = require('lodash');
var analytics = require('../../analytics');
var common = require('../common');
var fileSystem = require('fs');
var lockFileParser = require('snyk-nodejs-lockfile-parser');

module.exports = test;

// important: this is different from ./config (which is the *user's* config)
var config = require('../../config');

function test(root, options) {
  var modules = null;
  var payload = {
    // options.vulnEndpoint is only used for file system tests
    url: config.API + (options.vulnEndpoint || '/vuln/npm'),
    json: true,
    headers: {
      'x-is-ci': isCI,
      authorization: 'token ' + snyk.api,
    },
  };
  var hasDevDependencies = false;

  // if the file exists, let's read the package files and post
  // the dependency tree to the server.
  // if it doesn't, then we're assuming this is an existing
  // module on npm, so send the bare argument
  return fs.exists(root)
    .then((exists) => {
      if (!exists) {
        var module = moduleToObject(root);
        debug('testing remote: %s', module.name + '@' + module.version);
        payload.method = 'GET';
        payload.url += '/' +
          encodeURIComponent(module.name + '@' + module.version);
        payload.qs = common.assembleQueryString(options);
        return {
          package: module,
          payload: payload,
        };
      }
      var policyLocations = [options['policy-path'] || root];
      options.file = options.file || 'package.json';
      return Promise.resolve()
        .then(() => {
          if (options.file.endsWith('package-lock.json')
            || options.file.endsWith('yarn.lock')) {
            return generateDependenciesFromLockfile(root, options);
          }
          return getDependenciesFromNodeModules(root, options)
            .then((pkg) => {
              // HACK: using side effect (outer-scope variable mutation)
              // In this case, `pkg` is an object with methods (as opposed to a dependency tree)
              // and is used as source for .pluck() in queryForVulns().
              modules = pkg;
              return pkg;
            });
        }).then((pkg) => {
          // if there's no package name, let's get it from the root dir
          if (!pkg.name) {
            pkg.name = path.basename(path.resolve(root));
          }
          policyLocations = policyLocations.concat(pluckPolicies(pkg));
          debug('policies found', policyLocations);
          analytics.add('policies', policyLocations.length);
          hasDevDependencies = pkg.hasDevDependencies;
          payload.method = 'POST';
          payload.body = pkg;
          payload.qs = common.assembleQueryString(options);
          // load all relevant policies, apply relevant options
          return snyk.policy.load(policyLocations, options)
            .then(function (policy) {
              payload.body.policy = policy.toString();
              return {
                package: pkg,
                payload: payload,
              };
            }, function (error) { // note: inline catch, to handle error from .load
            // the .snyk file wasn't found, which is fine, so we'll return
              if (error.code === 'ENOENT') {
                return {
                  package: pkg,
                  payload: payload,
                };
              }
              throw error;
            });
        });
    }).then((data) => {
      // modules is either null (as defined) or was updated during the flow using node modules
      return queryForVulns(data, modules, hasDevDependencies, root, options);
    });
}

function generateDependenciesFromLockfile(root, options) {
  debug('Lockfile detected, generating dependency tree from lockfile');
  const fileName = options.file;
  var lockFileFullPath = path.resolve(root, fileName);
  if (!fileSystem.existsSync(lockFileFullPath)) {
    throw new Error('Lockfile ' + fileName + ' not found at location: ' +
    lockFileFullPath);
  }

  var fullPath = path.parse(lockFileFullPath);
  var manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');
  var shrinkwrapFullPath = path.resolve(fullPath.dir, 'npm-shrinkwrap.json');

  if (!fileSystem.existsSync(manifestFileFullPath)) {
    throw new Error('Manifest file package.json not found at location: ' +
      manifestFileFullPath);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error('Detected a lockfile at location: '
    + lockFileFullPath + '\n However the package.json is missing!');
  }

  if (fileSystem.existsSync(shrinkwrapFullPath)) {
    throw new Error('`npm-shrinkwrap.json` was found while using lockfile.\n'
    + 'Please run your command again without `--file=' + fileName + '` flag.');
  }

  var manifestFile = fileSystem.readFileSync(manifestFileFullPath);
  var lockFile = fileSystem.readFileSync(lockFileFullPath, 'utf-8');

  analytics.add('local', true);
  analytics.add('using lockfile (' + fileName + ') package-lock.json to get dependency tree', true);

  const lockFileType = fileName.endsWith('yarn.lock') ?
    lockFileParser.LockfileType.yarn : lockFileParser.LockfileType.npm;

  var resolveModuleSpinnerLabel = `Analyzing npm dependencies for ${lockFileFullPath}`;
  debug(resolveModuleSpinnerLabel);
  return spinner(resolveModuleSpinnerLabel)
    .then(function () {
      return lockFileParser.buildDepTree(manifestFile, lockFile, options.dev, lockFileType);
    })
    // clear spinner in case of success or failure
    .then(spinner.clear(resolveModuleSpinnerLabel))
    .catch(function (error) {
      spinner.clear(resolveModuleSpinnerLabel)();
      throw error;
    });
}

function getDependenciesFromNodeModules(root, options) {
  return fs.exists(path.join(root, 'node_modules'))
    .then(function (nodeModulesExist) {
      if (!nodeModulesExist) {
        // throw a custom error
        throw new Error('Missing node_modules folder: we can\'t test ' +
          'without dependencies.\nPlease run `npm install` first.');
      }
      analytics.add('local', true);
      analytics.add('using node_modules to get dependency tree', true);
      options.root = root;
      var resolveModuleSpinnerLabel = 'Analyzing npm dependencies for ' +
        path.relative('.', path.join(root, options.file));
      return spinner(resolveModuleSpinnerLabel)
        .then(function () {
          return snyk.modules(
            root, Object.assign({}, options, {noFromArrays: true}));
        })
        // clear spinner in case of success or failure
        .then(spinner.clear(resolveModuleSpinnerLabel))
        .catch(function (error) {
          spinner.clear(resolveModuleSpinnerLabel)();
          throw error;
        });
    });
}

function queryForVulns(data, modules, hasDevDependencies, root, options) {
  var lbl = 'Querying vulnerabilities database...';

  return spinner(lbl)
    .then(function () {
      var filesystemPolicy = data.payload.body && !!data.payload.body.policy;
      analytics.add('packageManager', 'npm');
      analytics.add('packageName', data.package.name);
      analytics.add('packageVersion', data.package.version);
      analytics.add('package', data.package.name + '@' + data.package.version);

      return new Promise(function (resolve, reject) {
        request(data.payload, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode !== 200) {
            var err = new Error(body && body.error ?
              body.error :
              res.statusCode);

            err.cliMessage = body && body.cliMessage;
            // this is the case where a local module has been tested, but
            // doesn't have any production deps, but we've noted that they
            // have dep deps, so we'll error with a more useful message
            if (res.statusCode === 404 && hasDevDependencies) {
              err.code = 'NOT_FOUND_HAS_DEV_DEPS';
            } else {
              err.code = res.statusCode;
            }

            if (res.statusCode === 500) {
              debug('Server error', body.stack);
            }

            return reject(err);
          }

          body.filesystemPolicy = filesystemPolicy;

          resolve(body);
        });
      });
    }).then(function (res) {
      // This branch is valid for node modules flow only
      if (modules) {
        res.dependencyCount = modules.numDependencies;
        if (res.vulnerabilities) {
          res.vulnerabilities.forEach(function (vuln) {
            var plucked = modules.pluck(vuln.from, vuln.name, vuln.version);
            vuln.__filename = plucked.__filename;
            vuln.shrinkwrap = plucked.shrinkwrap;
            vuln.bundled = plucked.bundled;

            // this is an edgecase when we're testing the directly vuln pkg
            if (vuln.from.length === 1) {
              return;
            }

            var parentPkg = moduleToObject(vuln.from[1]);
            var parent = modules.pluck(vuln.from.slice(0, 2),
              parentPkg.name,
              parentPkg.version);
            vuln.parentDepType = parent.depType;
          });
        }
      }
      return res;
    }).then(function (res) {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      return Promise.resolve().then(function () {
        if (options['ignore-policy']) {
          return res;
        }

        return snyk.policy.loadFromText(res.policy)
          .then(function (policy) {
            return policy.filter(res, root);
          });
      }).then(function (res) {
        analytics.add('vulns', res.vulnerabilities.length);

        // add the unique count of vulnerabilities found
        res.uniqueCount = 0;
        var seen = {};
        res.uniqueCount = res.vulnerabilities.reduce(function (acc, curr) {
          if (!seen[curr.id]) {
            seen[curr.id] = true;
            acc++;
          }
          return acc;
        }, 0);

        return res;
      });
    })
    // clear spinner in case of success or failure
    .then(spinner.clear(lbl))
    .catch(function (error) {
      spinner.clear(lbl)();
      throw error;
    });
}

function pluckPolicies(pkg) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(Object.keys(pkg.dependencies).map(function (name) {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}
