import { ILogger } from '@splitsoftware/splitio-commons/src/logger/types';
import { ISettings } from '@splitsoftware/splitio-commons/src/types';
import { FLAG_SPEC_VERSION } from '@splitsoftware/splitio-commons/src/utils/constants';
import { isIntegerNumber } from '@splitsoftware/splitio-commons/src/utils/lang';
import { settingsValidation } from '@splitsoftware/splitio-commons/src/utils/settingsValidation/index';
import { validateLogger } from '@splitsoftware/splitio-commons/src/utils/settingsValidation/logger/builtinLogger';
import { ISynchronizerSettings } from '../../types';
import { defaults } from './defaults';

const FLAG_SPEC_VERSIONS = ['1.0', FLAG_SPEC_VERSION];

/**
 * Object with some default values to instantiate the application and fullfil internal
 * requirements.
 */
const params = {
  logger: validateLogger,
  defaults,
  consent: () => undefined,
  runtime: () => { return { ip: false, hostname: false }; },
  flagSpec: ({ sync: { flagSpecVersion }, log }: ISettings) => {
    if (FLAG_SPEC_VERSIONS.indexOf(flagSpecVersion) > -1) return flagSpecVersion;

    log.error(`settings: you passed an invalid "flagSpecVersion" config param. It should be one of the following values: ${FLAG_SPEC_VERSIONS.map((version => `"${version}"`))}. Defaulting to "${FLAG_SPEC_VERSION}"`);
    return FLAG_SPEC_VERSION;
  },
};

function validatePositiveInteger(log: ILogger, paramName: string, actualValue: any, defaultValue: number) {
  if (isIntegerNumber(actualValue) && actualValue > 0) return actualValue;

  log.warn(`'${paramName}' parameter must be a positive integer number. Using default value (${defaultValue}) instead.`);
  return defaultValue;
}

/**
 * Function to validate Synchronizer config.
 *
 * @param {any} config  Synchronizer config object provided by the user.
 * @returns {ISettings}
 */
export function synchronizerSettingsValidator(
  config: ISynchronizerSettings
): ISettings & ISynchronizerSettings {

  // @ts-ignore
  const settings = settingsValidation(config, params) as ISettings & ISynchronizerSettings;
  // @ts-ignore, override readonly prop
  settings.mode = undefined; // "producer" mode

  const { scheduler, log } = settings;

  // @TODO validate synchronizerMode eventually
  // @TODO: validate minimum and maximum value for config params.
  scheduler.eventsPerPost = validatePositiveInteger(log, 'eventsPerPost', scheduler.eventsPerPost, defaults.scheduler.eventsPerPost);
  scheduler.impressionsPerPost = validatePositiveInteger(log, 'impressionsPerPost', scheduler.impressionsPerPost, defaults.scheduler.impressionsPerPost);
  scheduler.maxRetries = validatePositiveInteger(log, 'maxRetries', scheduler.maxRetries, defaults.scheduler.maxRetries);

  return settings;
}
