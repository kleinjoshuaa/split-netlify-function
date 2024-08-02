import { synchronizerSettingsValidator } from '../index';
import { defaults } from '../defaults';
import { ISynchronizerSettings } from '../../../types';

describe('synchronizerSettingsValidator', () => {

  test('should return default values when no param or invalid param is provided', () => {
    const config: ISynchronizerSettings = {
      core: {
        authorizationKey: 'fake-key',
      },
      scheduler: {
        eventsPerPost: undefined, // not defined
        impressionsPerPost: -1, // invalid, must be a positive integer
        maxRetries: 10, // overwriting default value
      },
      sync: {
        // @ts-expect-error
        flagSpecVersion: 'invalid',
      },
      storage: { wrapper: {} },
    };
    const settings = synchronizerSettingsValidator(config);

    expect(settings.scheduler.eventsPerPost).toBe(defaults.scheduler.eventsPerPost);
    expect(settings.scheduler.impressionsPerPost).toBe(defaults.scheduler.impressionsPerPost);
    expect(settings.scheduler.maxRetries).toBe(config.scheduler!.maxRetries);
    expect(settings.sync.flagSpecVersion).toBe('1.1');
  });

});
