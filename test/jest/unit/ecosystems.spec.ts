import * as cppPlugin from 'snyk-cpp-plugin';
import * as ecosystems from '../../../src/lib/ecosystems';
import { Options } from '../../../src/lib/types';

describe('ecosystems', () => {
  describe('getPlugin', () => {
    it('should return cpp plugin when cpp ecosystem is given', () => {
      const actual = ecosystems.getPlugin('cpp');
      const expected = cppPlugin;
      expect(actual).toBe(expected);
    });

    it('should return undefined when ecosystem is not supported', () => {
      const actual = ecosystems.getPlugin('unsupportedEcosystem' as any);
      const expected = undefined;
      expect(actual).toBe(expected);
    });
  });

  describe('getEcosystem', () => {
    it('should return cpp ecosystem when options source is true', () => {
      const options: Options = {
        source: true,
        path: '',
      };
      const actual = ecosystems.getEcosystem(options);
      const expected = 'cpp';
      expect(actual).toBe(expected);
    });
    it('should return null when options source is false', () => {
      const options: Options = {
        source: false,
        path: '',
      };
      const actual = ecosystems.getEcosystem(options);
      const expected = null;
      expect(actual).toBe(expected);
    });
  });
});
