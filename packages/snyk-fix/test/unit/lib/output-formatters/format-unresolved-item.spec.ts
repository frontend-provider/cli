import stripAnsi = require('strip-ansi');
import { formatUnresolved } from '../../../../src/lib/output-formatters/format-unresolved-item';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('format unresolved item', () => {
  it('formats unresolved as expected by default', () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const res = formatUnresolved(entity, 'Failed to process item');
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('formats ok when missing targetFile', () => {
    const entity = generateEntityToFix(
      'npm',
      undefined as any,
      JSON.stringify({}),
    );
    const res = formatUnresolved(entity, 'Failed to process item');
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('formats ok with tip', () => {
    const entity = generateEntityToFix('pip', 'Pipfile', JSON.stringify({}));
    const res = formatUnresolved(
      entity,
      'Failed to fix',
      'Make sure you have pipenv installed',
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
