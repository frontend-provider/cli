import { getVersion, isStandaloneBuild } from '../../lib/version';

export = async () => {
  let version = await getVersion();
  if (isStandaloneBuild()) {
    version += ' (standalone)';
  }
  return version;
};
