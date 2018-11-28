var restify = require('restify');
var fs = require('fs');

module.exports = function (root, apikey) {
  var server = restify.createServer({
    name: 'snyk-mock-server',
    version: '1.0.0',
  });
  server._reqLog = [];
  server.popRequest = function () {
    return server._reqLog.pop();
  };
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  server.use(function logRequest(req, res, next) {
    server._reqLog.push(req);
    next();
  });

  [
    root + '/verify/callback',
    root + '/verify/token',
  ].map(function (url) {
    server.post(url, function (req, res) {
      if (req.params.api && req.params.api === apikey) {
        return res.send({
          ok: true,
          api: apikey,
        });
      }

      if (req.params.token) {
        return res.send({
          ok: true,
          api: apikey,
        });
      }

      res.status(401);
      res.send({
        ok: false,
      });
    });
  });

  server.use(function (req, res, next) {
    if (!server._nextResponse) {
      return next();
    }
    var response = server._nextResponse;
    delete server._nextResponse;
    res.send(response);
  });

  server.get(root + '/vuln/:registry/:module', function (req, res, next) {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/vuln/:registry', function (req, res, next) {
    var vulnerabilities = [];
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }
    res.send({
      vulnerabilities: vulnerabilities,
      org: 'test-org',
      isPrivate: true,
    });
    return next();
  });

  server.post(root + '/vuln/:registry/patches', function (req, res, next) {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/test-dep-graph', function (req, res, next) {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }

    res.send({
      result: {
        issuesData: {},
        affectedPkgs: {},
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
    return next();
  });

  server.put(root + '/monitor/:registry', function (req, res, next) {
    res.send({
      id: 'test',
    });
    return next();
  });

  server.setNextResponse = function (response) {
    server._nextResponse = response;
  };

  return server;
};
