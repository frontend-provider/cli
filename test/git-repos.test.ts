import * as cli from '../src/cli/commands/';
import * as tap from 'tap';
const test = tap.test;

const urls = [
  // a repo with no dependencies so it will never be vulnerable (2017-05-15)
  'https://github.com/Snyk/vulndb-fixtures',
  'https://github.com/Snyk/vulndb-fixtures.git',
  'git@github.com:Snyk/vulndb-fixtures.git',
  'Snyk/vulndb-fixtures.git',
];

urls.forEach((url) => {
  test('snyk.test supports ' + url + ' structure', async (t) => {
    try {
      await cli.test(url);
      t.pass('url worked');
    } catch (err) {
      t.threw(err);
      t.end();
    }
  });
});
