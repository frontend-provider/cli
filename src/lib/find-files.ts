import * as fs from 'fs';
import * as pathLib from 'path';
// TODO: use util.promisify once we move to node 8

/**
 * Returns files inside given file path.
 *
 * @param path file path.
 */
export async function readDirectory(path: string): Promise<string[]> {
  return await new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
}

/**
 * Returns file stats object for given file path.
 *
 * @param path path to file or directory.
 */
export async function getStats(path: string): Promise<fs.Stats> {
  return await new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        reject(err);
      }
      resolve(stats);
    });
  });
}

/**
 * Find all files in given search path. Returns paths to files found.
 *
 * @param path file path to search.
 * @param ignore (optional) files to ignore. Will always ignore node_modules.
 * @param filter (optional) file names to find. If not provided all files are returned.
 * @param levelsDeep (optional) how many levels deep to search, defaults to two, this path and one sub directory.
 */
export async function find(
  path: string,
  ignore: string[] = [],
  filter: string[] = [],
  levelsDeep = 2,
): Promise<string[]> {
  const found: string[] = [];
  // ensure we ignore find against node_modules path.
  if (path.endsWith('node_modules')) {
    return found;
  }
  // ensure node_modules is always ignored
  if (!ignore.includes('node_modules')) {
    ignore.push('node_modules');
  }
  try {
    if (levelsDeep < 0) {
      return found;
    } else {
      levelsDeep--;
    }
    const fileStats = await getStats(path);
    if (fileStats.isDirectory()) {
      const files = await findInDirectory(path, ignore, filter, levelsDeep);
      found.push(...files);
    } else if (fileStats.isFile()) {
      const fileFound = findFile(path, filter);
      if (fileFound) {
        found.push(fileFound);
      }
    }
    return found;
  } catch (err) {
    throw new Error(`Error finding files in path '${path}'.\n${err.message}`);
  }
}

function findFile(path: string, filter: string[] = []): string | null {
  if (filter.length > 0) {
    const filename = pathLib.basename(path);
    if (filter.includes(filename)) {
      return path;
    }
  } else {
    return path;
  }
  return null;
}

async function findInDirectory(
  path: string,
  ignore: string[] = [],
  filter: string[] = [],
  levelsDeep = 2,
): Promise<string[]> {
  const files = await readDirectory(path);
  const toFind = files
    .filter((file) => !ignore.includes(file))
    .map((file) => {
      const resolvedPath = pathLib.resolve(path, file);
      return find(resolvedPath, ignore, filter, levelsDeep);
    });
  const found = await Promise.all(toFind);
  return Array.prototype.concat.apply([], found);
}
