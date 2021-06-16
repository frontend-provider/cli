import {
  getHandlerType,
  isRequirementsTxtManifest,
} from '../../../../../../src/plugins/python/get-handler-type';
import { SUPPORTED_HANDLER_TYPES } from '../../../../../../src/plugins/python/supported-handler-types';
import { generateEntityToFix } from '../../../../../helpers/generate-entity-to-fix';

describe('getHandlerType', () => {
  it('pip + requirements.txt is supported project type `requirements.txt`', () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.REQUIREMENTS);
  });

  it('pip + dev.txt is supported project type `requirements.txt`', () => {
    const entity = generateEntityToFix('pip', 'dev.txt', 'django==1.6.1');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.REQUIREMENTS);
  });

  it('pip + Pipfile is supported project type `Pipfile`', () => {
    const entity = generateEntityToFix('pip', 'Pipfile', '');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.PIPFILE);
  });

  it('poetry + pyproject.toml is supported project type `pyproject.toml`', () => {
    const entity = generateEntityToFix('poetry', 'pyproject.toml', '');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.POETRY);
  });
  it('poetry + poetry.lock is supported project type `pyproject.toml`', () => {
    const entity = generateEntityToFix('poetry', 'poetry.lock', '');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.POETRY);
  });
});

describe('isRequirementsTxtManifest', () => {
  it('dev.txt is requirements.txt manifest', () => {
    expect(isRequirementsTxtManifest('dev.txt')).toBeTruthy();
  });

  it('lib/prod.txt is requirements.txt manifest', () => {
    expect(isRequirementsTxtManifest('dev.txt')).toBeTruthy();
  });
  it('requirements.txt is correctly classed as requirements.txt manifest', () => {
    expect(isRequirementsTxtManifest('requirements.txt')).toBeTruthy();
  });

  it('package.json is correctly classed as NOT a requirements.txt manifest', () => {
    expect(isRequirementsTxtManifest('package.json')).toBeFalsy();
  });
});
