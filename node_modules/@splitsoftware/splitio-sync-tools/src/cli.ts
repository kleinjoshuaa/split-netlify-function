import fs from 'fs';
import { exit, env, argv } from 'process';
import { Synchronizer } from './Synchronizer';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { IPluggableStorageWrapper } from '@splitsoftware/splitio-commons/src/storages/types';
import { ISynchronizerSettings } from '../types';

type CustomModeOption = 'featureFlagsAndSegments' | 'eventsAndImpressions' | undefined;

dotenv.config();

console.log('# Synchronizer: Initialization');

/**
 * The API Url .
 */
let _sdkApiUrl: string | undefined;
/**
 * The Events API Url.
 */
let _eventsApiUrl: string | undefined;
/**
 * The Telemetry API Url.
 */
let _telemetryApiUrl: string | undefined;
/**
 * The SDK key value.
 */
let _sdkKey: string | undefined;
/**
 * The Pluggable Storage prefix.
 */
let _storagePrefix: string | undefined;
/**
 * The reference to the provided Storage path file.
 */
let _pluggableStoragePath: string;
/**
 * The reference for the Impressions Mode configuration.
 */
let _impressionsMode: string;
/**
 * The flag to enable the Logger debug mode.
 */
let _debug: boolean;
/**
 * The reference to the provided Storage.
 */
let _storageWrapper: IPluggableStorageWrapper;
/**
 * Object that contains Synchronizer specific configs.
 */
const _scheduler: NonNullable<ISynchronizerSettings['scheduler']> = {
  // @ts-ignore
  synchronizerMode: 'MODE_RUN_ALL',
};

// @todo: refactor param alias and args to be all wrapped under the `options` function.
const yargv = yargs(hideBin(argv))
  .usage('Usage: $0 [options]')
  .command('sync', 'Start synchronising tasks.')
  .example('$0 -m json --config path2/file.json -s path2/storage.js', '| Set settings from JSON file. -d')
  .example('$0 -m env -s path2/storage.js', '| Set settings from .env file.')
  .example(
    '$0 -k {A_VALID_SDK_KEY} -s path2/storage.js -r https://events.split.io/api/',
    '| Set SDK Key and Split API URL from param.'
  )
  .example('$0 -m env [...] -d', '| Set Debug Logging enabled')
  .example('$0 -m env [...] -i', '| Set Impressions Mode Debug mode')
  .options({
    // c: {
    //   alias: 'customRun',
    //   type: 'string',
    //   description: 'Set a custom execution to run: featureFlagsAndSegments | eventsAndImpressions',
    //   choices: ['featureFlagsAndSegments', 'eventsAndImpressions'],
    // },
    s: {
      alias: 'storage',
      describe: 'Path to the JS file exposing the Storage API',
      type: 'string',
      nargs: 1,
    },
    d: {
      alias: 'debug',
      describe: 'Set debug Logger enable',
      type: 'boolean',
      nargs: 0,
    },
    k: {
      alias: 'sdkKey',
      describe: 'Set the SDK key',
      type: 'string',
      nargs: 1,
    },
    r: {
      alias: 'apiUrl',
      describe: 'Set the Split API URL',
      type: 'string',
      nargs: 1,
    },
    e: {
      alias: 'eventsApiUrl',
      describe: 'Set the Split Events API URL',
      type: 'string',
      nargs: 1,
    },
    l: {
      alias: 'telemetryApiUrl',
      describe: 'Set the Split Telemetry API URL',
      type: 'string',
      nargs: 1,
    },
    m: {
      alias: 'mode',
      type: 'string',
      description: 'Set config mode: json | env',
      choices: ['env', 'json'],
      nargs: 1,
    },
    p: {
      alias: 'prefix',
      describe: 'Set the Storage prefix',
      type: 'string',
      nargs: 1,
    },
    n: {
      alias: 'eventsPerPost',
      description: 'Set the number of events to send in a POST request',
      nargs: 1,
    },
    f: {
      alias: 'impressionsPerPost',
      description: 'Set the number of impressions to send in a POST request',
      nargs: 1,
    },
    t: {
      alias: 'maxRetries',
      description: 'Set the number of retries attempt perform an Event or Impression POST request',
      nargs: 1,
    },
    i: {
      alias: 'impressionsMode',
      type: 'string',
      description: 'This configuration defines how impressions are queued: optimized | debug',
      choices: ['optimized', 'debug'],
      nargs: 1,
    },
    // g: {
    //   alias: 'inMemoryOperation',
    //   type: 'boolean',
    //   description: 'Flag that enables all the synchronization operations to be proccessed in Memory.',
    //   nargs: 0,
    // },
  })
  .config('config', (configPath) => JSON.parse(fs.readFileSync(configPath, 'utf-8')))
  .help('h')
  .alias('h', 'help')
  .epilog(`copyright ${new Date().getFullYear()}`)
  .argv;

const {
  mode,
  storage,
  STORAGE_PATH,
  SDK_KEY,
  sdkKey,
  apiUrl,
  API_URL,
  eventsApiUrl,
  EVENTS_API_URL,
  telemetryApiUrl,
  TELEMETRY_API_URL,
  debug,
  DEBUG,
  // inMemoryOperation,
  // IN_MEMORY_OPERATION,
  prefix,
  STORAGE_PREFIX,
  customRun,
  CUSTOM_RUN,
  impressionsMode,
  IMPRESSIONS_MODE,
  eventsPerPost,
  impressionsPerPost,
  maxRetries,
  MAX_RETRIES,
  EVENTS_PER_POST,
  IMPRESSIONS_PER_POST,
} = yargv;

console.log(` > Synchronizer configs from: ${mode || 'CLI params'}`);
/**
 * Function to set the Synchronizer Execution Mode.
 *
 * @param {CustomModeOption} _customRun  Option provided by the CLI or config (env|json).
 */
const setCustomRun = (_customRun: CustomModeOption | undefined) => {
  switch (_customRun) {
    case 'featureFlagsAndSegments':
      // @ts-ignore
      _scheduler.synchronizerMode = 'MODE_RUN_FEATURE_FLAGS_AND_SEGMENTS';
      break;
    case 'eventsAndImpressions':
      // @ts-ignore
      _scheduler.synchronizerMode = 'MODE_RUN_EVENTS_AND_IMPRESSIONS';
      break;
    default:
      // @ts-ignore
      _scheduler.synchronizerMode = 'MODE_RUN_ALL';
  }
};

switch (mode) {
  case 'json':
    _sdkKey = SDK_KEY as string;
    _sdkApiUrl = API_URL as string;
    _eventsApiUrl = EVENTS_API_URL as string;
    _telemetryApiUrl = TELEMETRY_API_URL as string;
    _storagePrefix = STORAGE_PREFIX as string;
    _pluggableStoragePath = STORAGE_PATH as string;
    _impressionsMode = IMPRESSIONS_MODE as string;
    _debug = DEBUG as unknown as boolean;
    _scheduler.eventsPerPost = EVENTS_PER_POST as number;
    _scheduler.impressionsPerPost = IMPRESSIONS_PER_POST as number;
    _scheduler.maxRetries = MAX_RETRIES as number;
    // synchronizerConfigs.inMemoryOperation = IN_MEMORY_OPERATION as boolean;
    setCustomRun(CUSTOM_RUN as CustomModeOption);
    break;
  case 'env':
    _sdkKey = env.SDK_KEY;
    _sdkApiUrl = env.API_URL;
    _eventsApiUrl = env.EVENTS_API_URL;
    _telemetryApiUrl = env.TELEMETRY_API_URL;
    _storagePrefix = env.STORAGE_PREFIX as string;
    _pluggableStoragePath = env.STORAGE_PATH as string;
    _impressionsMode = env.IMPRESSIONS_MODE as string;
    _debug = env.DEBUG as unknown as boolean;
    _scheduler.eventsPerPost = env.EVENTS_PER_POST as unknown as number;
    _scheduler.impressionsPerPost = env.IMPRESSIONS_PER_POST as unknown as number;
    _scheduler.maxRetries = env.MAX_RETRIES as unknown as number;
    // synchronizerConfigs.inMemoryOperation = env.IN_MEMORY_OPERATION as unknown as boolean;
    setCustomRun(env.CUSTOM_RUN as CustomModeOption);
    break;
  default:
    _sdkKey = sdkKey as string;
    _sdkApiUrl = apiUrl as string;
    _eventsApiUrl = eventsApiUrl as string;
    _telemetryApiUrl = telemetryApiUrl as string;
    _storagePrefix = prefix as string;
    _pluggableStoragePath = storage as string;
    _impressionsMode = impressionsMode as string;
    _debug = debug as boolean;
    _scheduler.eventsPerPost = eventsPerPost as number;
    _scheduler.impressionsPerPost = impressionsPerPost as number;
    _scheduler.maxRetries = maxRetries as number;
    // synchronizerConfigs.inMemoryOperation = inMemoryOperation as boolean;
    setCustomRun(customRun as CustomModeOption);
    break;
}

try {
  // If `default` property is defined, use as storage wrapper
  const module = require(`${process.cwd()}/${_pluggableStoragePath}`);
  _storageWrapper = typeof module.default === 'object' ? module.default : module;
} catch (error: any) {
  console.log('Error importing Storage: ', error && error.message);
  exit(1);
}

if (!_sdkKey) {
  console.log('Unable to initialize Synchronizer task: missing SDK KEY.');
  exit(1);
}

/**
 * Synchronizer creation.
 */
const synchronizer = new Synchronizer({
  core: {
    authorizationKey: _sdkKey,
  },
  urls: {
    sdk: _sdkApiUrl,
    events: _eventsApiUrl,
    telemetry: _telemetryApiUrl,
  },
  storage: {
    type: 'PLUGGABLE',
    prefix: _storagePrefix,
    wrapper: _storageWrapper,
  },
  sync: {
    // @ts-ignore
    impressionsMode: _impressionsMode?.toUpperCase() || 'OPTIMIZED',
  },
  scheduler: _scheduler,
  debug: _debug,
});

/**
 * Function to exit node with error.
 */
function informFailedExecute() {
  console.log('# Split Synchronizer tool execution terminated with issues');
  process.exit(1);
}

synchronizer.execute().then((success) => {
  if (!success) {
    console.log('# Synchronizer execution terminated.');
    informFailedExecute();
  }
  exit(0);
}, informFailedExecute);
