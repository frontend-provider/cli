import * as path from 'path';
import * as fs from 'fs';
import { EngineType } from './types';
import * as needle from 'needle';
import { createIacDir, extractBundle } from './file-utils';
import ReadableStream = NodeJS.ReadableStream;

export const LOCAL_POLICY_ENGINE_DIR = '.iac-data';

const KUBERNETES_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'k8s_policy.wasm',
);
const KUBERNETES_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'k8s_data.json',
);
const TERRAFORM_POLICY_ENGINE_WASM_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_policy.wasm',
);
const TERRAFORM_POLICY_ENGINE_DATA_PATH = path.join(
  LOCAL_POLICY_ENGINE_DIR,
  'tf_data.json',
);

export const REQUIRED_LOCAL_CACHE_FILES = [
  KUBERNETES_POLICY_ENGINE_WASM_PATH,
  KUBERNETES_POLICY_ENGINE_DATA_PATH,
  TERRAFORM_POLICY_ENGINE_WASM_PATH,
  TERRAFORM_POLICY_ENGINE_DATA_PATH,
];

export function isLocalCacheExists(): boolean {
  return REQUIRED_LOCAL_CACHE_FILES.every(fs.existsSync);
}

export function getLocalCachePath(engineType: EngineType) {
  switch (engineType) {
    case EngineType.Kubernetes:
      return [
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${KUBERNETES_POLICY_ENGINE_DATA_PATH}`,
      ];
    case EngineType.Terraform:
      return [
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_WASM_PATH}`,
        `${process.cwd()}/${TERRAFORM_POLICY_ENGINE_DATA_PATH}`,
      ];
  }
}

export async function initLocalCache(): Promise<void> {
  // temporarily use an ENV var to skip downloading of the bundles if we need to - e.g. smoke tests
  if (!process.env.SNYK_IAC_SKIP_BUNDLE_DOWNLOAD) {
    const preSignedUrl =
      'https://cloud-config-policy-bundles.s3-eu-west-1.amazonaws.com/bundle.tar.gz';
    const fileName: fs.PathLike = path.join('.iac-data/bundle.tar.gz');

    createIacDir();
    const response: ReadableStream = await needle.get(preSignedUrl);
    await extractBundle(response, fileName);
  }
  if (!isLocalCacheExists()) {
    throw Error(
      `Missing IaC local cache data, please validate you have: \n${REQUIRED_LOCAL_CACHE_FILES.join(
        '\n',
      )}`,
    );
  }
}
