module.exports = monitor;

var _ = require('lodash');
var fs = require('then-fs');
var apiTokenExists = require('../../lib/api-token').exists;
var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');
var chalk = require('chalk');
var pathUtil = require('path');
var spinner = require('../../lib/spinner');

var detect = require('../../lib/detect');
var plugins = require('../../lib/plugins');
var ModuleInfo = require('../../lib/module-info');
var docker = require('../../lib/docker-promotion');
var SEPARATOR = '\n-------------------------------------------------------\n';

function monitor() {
  var args = [].slice.call(arguments, 0);
  var options = {};
  var results = [];
  if (typeof args[args.length - 1] === 'object') {
    options = args.pop();
  }

  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length ===  0) {
    args.unshift(process.cwd());
  }

  if (options.id) {
    snyk.id = options.id;
  }

  return apiTokenExists('snyk monitor')
    .then(function () {
      return args.reduce(function (acc, path) {
        return acc.then(function () {
          return fs.exists(path).then(function (exists) {
            if (!exists && !options.docker) {
              throw new Error(
                '"' + path + '" is not a valid path for "snyk monitor"');
            }

            var packageManager = detect.detectPackageManager(path, options);

            var targetFile = options.docker && !options.file // snyk monitor --docker (without --file)
              ? undefined
              : (options.file || detect.detectPackageFile(path));


            var plugin = plugins.loadPlugin(packageManager, options);

            var moduleInfo = ModuleInfo(plugin, options.policy);

            var displayPath = pathUtil.relative(
              '.', pathUtil.join(path, targetFile || ''));

            var analysisType = options.docker ? 'docker' : packageManager;

            var analyzingDepsSpinnerLabel =
          'Analyzing ' + analysisType + ' dependencies for ' + displayPath;

            var postingMonitorSpinnerLabel =
          'Posting monitor snapshot for ' + displayPath + ' ...';

            return spinner(analyzingDepsSpinnerLabel)
              .then(function () {
                return moduleInfo.inspect(path, targetFile, options);
              })
            // clear spinner in case of success or failure
              .then(spinner.clear(analyzingDepsSpinnerLabel))
              .catch(function (error) {
                spinner.clear(analyzingDepsSpinnerLabel)();
                throw error;
              })
              .then(function (info) {
                return spinner(postingMonitorSpinnerLabel)
                  .then(function () {
                    return info;
                  });
              })
              .then(function (info) {
                if (_.get(info, 'plugin.packageManager')) {
                  packageManager = info.plugin.packageManager;
                }
                var meta = {
                  method: 'cli',
                  packageManager: packageManager,
                  'policy-path': options['policy-path'],
                  'project-name':
                options['project-name'] || config['PROJECT_NAME'],
                  isDocker: !!options.docker,
                };
                return snyk.monitor(path, meta, info);
              })
            // clear spinner in case of success or failure
              .then(spinner.clear(postingMonitorSpinnerLabel))
              .catch(function (error) {
                spinner.clear(postingMonitorSpinnerLabel)();
                throw error;
              })
              .then(function (res) {
                res.path = path;
                var endpoint = url.parse(config.API);
                var leader = '';
                if (res.org) {
                  leader = '/org/' + res.org;
                }
                endpoint.pathname = leader + '/manage';
                var manageUrl = url.format(endpoint);

                endpoint.pathname = leader + '/monitor/' + res.id;
                var output = formatMonitorOutput(
                  packageManager,
                  res,
                  manageUrl,
                  options
                );
                // push a good result
                results.push({ok: true, data: output, path: path});
              });
          }).catch(function (err) {
          // push this error so the promise chain continues
            results.push({ok: false, data: err, path: path});
          });
        });
      }, Promise.resolve())
        .then(function () {
          if (options.json) {
            var dataToSend = results.map(function (result) {
              if (result.ok) {
                return JSON.parse(result.data);
              }
              return {ok: false, error: result.data.message, path: result.path};
            });
            // backwards compat - strip array if only one result
            dataToSend = dataToSend.length === 1 ? dataToSend[0] : dataToSend;
            var json = JSON.stringify(dataToSend, null, 2);

            if (results.every(function (res) {
              return res.ok;
            })) {
              return json;
            }

            throw new Error(json);
          }

          const output = results.map(function (res) {
            if (res.ok) {
              return res.data;
            }

            var errorMessage = (res.data && res.data.userMessage) ?
              chalk.bold.red(res.data.userMessage) :
              (res.data ? res.data.message : 'Unknown error occurred.');

            return chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') +
              errorMessage;
          }).join('\n' + SEPARATOR);

          if (results.every(function (res) {
            return res.ok;
          })) {
            return output;
          }

          throw new Error(output);
        });
    });
}

function formatMonitorOutput(packageManager, res, manageUrl, options) {
  var issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  var strOutput = chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') +
    (packageManager === 'yarn' ?
      'A yarn.lock file was detected - continuing as a Yarn project.\n' : '') +
      'Explore this snapshot at ' + res.uri + '\n\n' +
    (res.isMonitored ?
      'Notifications about newly disclosed ' + issues + ' related ' +
      'to these dependencies will be emailed to you.\n' :
      chalk.bold.red('Project is inactive, so notifications are turned ' +
        'off.\nActivate this project here: ' + manageUrl + '\n\n')) +
    (res.trialStarted ?
      chalk.yellow('You\'re over the free plan usage limit, \n' +
        'and are now on a free 14-day premium trial.\n' +
        'View plans here: ' + manageUrl + '\n\n') :
      '');

  if (docker.shouldSuggestDocker(options)) {
    strOutput += chalk.bold.white(docker.suggestionText);
  }

  return options.json ?
    JSON.stringify(_.assign({}, res, {
      manageUrl: manageUrl,
      packageManager: packageManager,
    })) : strOutput;
}
