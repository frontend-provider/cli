import * as path from 'path';
import { findPhysicalModules } from '../../src/lib/explore-node-modules';

describe(findPhysicalModules.name, () => {
  it('works with no matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/no-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);
    const found = findPhysicalModules(fixtureFolder, ['lodash']);
    expect(found).toHaveLength(0);
  });

  it('works with single matching physical module', () => {
    const fixtureFolderRelativePath = '../fixtures/single-patchable-module';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);
    const found = findPhysicalModules(fixtureFolder, ['lodash']);
    expect(found).toHaveLength(1);
    const m = found[0];
    expect(m.packageName).toBe('lodash');
    expect(m.packageVersion).toBe('4.17.15');
    expect(m.path).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });

  it('works with multiple matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/multiple-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);
    const found = findPhysicalModules(fixtureFolder, ['lodash']);
    expect(found).toHaveLength(2);
    const m0 = found[0];
    expect(m0.packageName).toBe('lodash');
    expect(m0.packageVersion).toBe('4.17.15');
    expect(m0.path).toEqual(
      path.join(__dirname, fixtureFolderRelativePath, '/node_modules/lodash'),
    );
    const m1 = found[1];
    expect(m1.packageName).toBe('lodash');
    expect(m1.packageVersion).toBe('4.17.15');
    expect(m1.path).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });
});
