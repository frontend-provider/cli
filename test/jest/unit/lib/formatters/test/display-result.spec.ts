import * as fs from 'fs';
import stripAnsi from 'strip-ansi';
import { displayResult } from '../../../../../../src/lib/formatters/test/display-result';
import { getWorkspacePath } from '../../../../util/getWorkspacePath';
import { getFixturePath } from '../../../../util/getFixturePath';

describe('displayResult', () => {
  it('Docker test result', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getWorkspacePath('fail-on/docker/fixable/vulns.json'),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src', docker: true },
      3,
    );
    expect(stripAnsi(res).replace(/http.*/g, '[URL]')).toMatchSnapshot();
  });

  it('Docker test result no file path and base image auto detected', () => {
    const withRemediationBaseImage = JSON.parse(
      fs.readFileSync(
        getWorkspacePath('fail-on/docker/fixable/vulns.json'),
        'utf8',
      ),
    );
    const withDetectedBaseImage = {
      ...withRemediationBaseImage,
      docker: { ...withRemediationBaseImage.docker, baseImage: 'base Image' },
    };

    const res = displayResult(
      withDetectedBaseImage,
      { showVulnPaths: 'all', path: 'src', docker: true },
      3,
    );
    expect(stripAnsi(res).replace(/http.*/g, '[URL]')).toMatchSnapshot();
  });

  it('Docker test result with base image non resolvable warning', () => {
    const withWarning = JSON.parse(
      fs.readFileSync(
        getWorkspacePath(
          'fail-on/docker/warning/dockerfile-base-image-non-resolvable.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withWarning,
      {
        showVulnPaths: 'all',
        file: 'Dockerfile',
        path: 'alpine:latest',
        docker: true,
      },
      1,
    );
    expect(stripAnsi(res).replace(/http.*/g, '[URL]')).toMatchSnapshot();
  });

  it('Docker test result with base image name not found warning', () => {
    const withWarning = JSON.parse(
      fs.readFileSync(
        getWorkspacePath(
          'fail-on/docker/warning/dockerfile-base-image-name-not-found.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withWarning,
      {
        showVulnPaths: 'all',
        file: 'Dockerfile',
        path: 'alpine:latest',
        docker: true,
      },
      1,
    );
    expect(stripAnsi(res).replace(/http.*/g, '[URL]')).toMatchSnapshot();
  });

  it('Docker test result with remediation advice', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getWorkspacePath(
          'fail-on/docker/fixable/vulns-with-docker-remediation.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src', docker: true },
      3,
    );
    expect(stripAnsi(res).replace(/http.*/g, '[URL]')).toMatchSnapshot();
  });

  it('Pip result with pins', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath('pip-app-with-remediation/test-graph-results.json'),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });

  it('with license issues', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getWorkspacePath(
          'ruby-app/test-graph-response-with-legal-instruction.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });

  it('with Upgrades & Patches', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath(
          'npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });
});
