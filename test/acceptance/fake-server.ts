import * as restify from 'restify';

interface FakeServer extends restify.Server {
  _reqLog: restify.Request[];
  _nextResponse?: restify.Response;
  _nextStatusCode?: number;
  popRequest: () => restify.Request;
  popRequests: (num: number) => restify.Request[];
  setNextResponse: (r: any) => void;
  setNextStatusCodeAndResponse: (c: number, r: any) => void;
}

export function fakeServer(root, apikey) {
  const server = restify.createServer({
    name: 'snyk-mock-server',
    version: '1.0.0',
  }) as FakeServer;
  server._reqLog = [];
  server.popRequest = () => {
    return server._reqLog.pop()!;
  };
  server.popRequests = (num: number) => {
    return server._reqLog.splice(server._reqLog.length - num, num);
  };
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  server.use(function logRequest(req, res, next) {
    server._reqLog.push(req);
    next();
  });

  [root + '/verify/callback', root + '/verify/token'].map((url) => {
    server.post(url, (req, res) => {
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

  server.use((req, res, next) => {
    if (!server._nextResponse && !server._nextStatusCode) {
      return next();
    }
    const response = server._nextResponse;
    delete server._nextResponse;
    if (server._nextStatusCode) {
      const code = server._nextStatusCode;
      delete server._nextStatusCode;
      res.send(code, response);
    } else {
      res.send(response);
    }
  });

  server.get(root + '/vuln/:registry/:module', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/vuln/:registry', (req, res, next) => {
    const vulnerabilities = [];
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }
    res.send({
      vulnerabilities,
      org: 'test-org',
      isPrivate: true,
    });
    return next();
  });

  server.post(root + '/vuln/:registry/patches', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/test-dep-graph', (req, res, next) => {
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

  server.get(
    root + '/cli-config/feature-flags/:featureFlag',
    (req, res, next) => {
      const flag = req.params.featureFlag;
      if ((req as any).params.org === 'no-flag') {
        res.send({
          ok: false,
          userMessage: `Org ${
            (req as any).org
          } doesn\'t have \'${flag}\' feature enabled'`,
        });
      }
      res.send({
        ok: true,
      });
      return next();
    },
  );

  server.put(root + '/monitor/:registry/graph', (req, res, next) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/graph/some/project-id`,
      isMonitored: true,
    });
    return next();
  });

  server.put(root + '/monitor/:registry', (req, res, next) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/some/project-id`,
      isMonitored: true,
    });
    return next();
  });

  server.setNextResponse = (response) => {
    server._nextResponse = response;
  };

  server.setNextStatusCodeAndResponse = (code, body) => {
    server._nextStatusCode = code;
    server._nextResponse = body;
  };

  return server;
}
