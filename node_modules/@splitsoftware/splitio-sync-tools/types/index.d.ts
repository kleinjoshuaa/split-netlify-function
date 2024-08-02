// Type definitions for Split JavaScript Sync Tools
// Project: http://www.split.io/
// Definitions by: Emiliano Sanchez <https://github.com/EmilianoSanchez/>

export = JsSyncTools;

declare module JsSyncTools {
  /**
   * JavaScript synchronizer tool.
   *
   * @see {@link https://help.split.io/hc/en-us/articles/4421513571469-Split-JavaScript-synchronizer-tools}.
   */
  export class Synchronizer {
    /**
     * Creates a new Synchronizer instance
     * @param config The synchronizer config object
     */
    constructor(config: ISynchronizerSettings);
    /**
     * Execute synchronization
     * @param cb Optional error-first callback to be invoked when the synchronization ends. The callback will be invoked with an error as first argument if the synchronization fails.
     * @return {Promise<boolean>} A promise that resolves when the operation ends,
     * with a boolean indicating if operation succeeded or not. The promise never rejects.
     */
    execute(cb?: (err?: Error) => void): Promise<boolean>;
    // @TODO expose settings eventually
    // settings: ISettings
  }

  /**
   * Log levels.
   *
   * @typedef {string} LogLevel
   */
  type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
  /**
   * Available URL settings for the synchronizer.
   */
  type UrlSettings = {
    /**
     * String property to override the base URL where the synchronizer will get feature flagging related data like a feature flag rollout plan or segments information.
     *
     * @property {string} sdk
     * @default 'https://sdk.split.io/api'
     */
    sdk?: string
    /**
     * String property to override the base URL where the synchronizer will post impressions and events.
     *
     * @property {string} events
     * @default 'https://events.split.io/api'
     */
    events?: string,
    /**
     * String property to override the base URL where the synchronizer will post telemetry data.
     *
     * @property {string} telemetry
     * @default 'https://telemetry.split.io/api'
     */
    telemetry?: string
  };

  /**
   * SplitFilter type.
   *
   * @typedef {string} SplitFilterType
   */
  type SplitFilterType = 'byName' | 'bySet';
  /**
   * Defines a feature flag filter, described by a type and list of values.
   */
  interface SplitFilter {
    /**
     * Type of the filter.
     *
     * @property {SplitFilterType} type
     */
    type: SplitFilterType,
    /**
     * List of values: feature flag names for 'byName' filter type, and feature flag name prefixes for 'byPrefix' type.
     *
     * @property {string[]} values
     */
    values: string[],
  }
  /**
   * ImpressionsMode type.
   *
   * @typedef {string} ImpressionsMode
   */
  type ImpressionsMode = 'OPTIMIZED' | 'DEBUG';
  /**
   * Settings interface for Synchronizer instances.
   *
   * @interface ISynchronizerSettings
   * @see {@link https://help.split.io/hc/en-us/articles/4421513571469-Split-JavaScript-synchronizer-tools#configuration}
   */
  interface ISynchronizerSettings {
    /**
     * Core settings.
     *
     * @property {Object} core
     */
    core: {
      /**
       * Your SDK key. More information: @see {@link https://help.split.io/hc/en-us/articles/360019916211-API-keys}
       *
       * @property {string} authorizationKey
       */
      authorizationKey: string
    }
    /**
     * Defines which kind of storage we should instanciate.
     *
     * @property {Object} storage
     */
    storage: {
      /**
       * Storage type. The only possible value is "PLUGGABLE", which is the default.
       * @property {'PLUGGABLE'} type
       */
      type?: 'PLUGGABLE',
      /**
       * A valid storage instance.
       *
       * @property {Object} wrapper
       */
      wrapper: Object
      /**
       * Optional prefix added to the storage keys to prevent any kind of data collision between SDK versions.
       *
       * @property {string} prefix
       * @default 'SPLITIO'
       */
      prefix?: string
    }
    /**
     * List of URLs that the Synchronizer will use as base for it's synchronization functionalities.
     * Do not change these settings unless you're working an advanced use case, like connecting to a proxy.
     *
     * @property {Object} urls
     */
    urls?: UrlSettings
    /**
     * Boolean value to indicate whether the logger should be enabled or disabled by default, or a log level string.
     *
     * Examples:
     * ```typescript
     * config.debug = true
     * config.debug = 'WARN'
     * ```
     * @property {boolean | LogLevel | ILogger} debug
     * @default false
     */
    debug?: boolean | LogLevel
    /**
     * Synchronization settings.
     * @property {Object} sync
     */
    sync?: {
      /**
       * List of feature flag filters. These filters are used to fetch a subset of the feature flag definitions in your environment.
       *
       * Example:
       *  `splitFilter: [
       *    { type: 'byName', values: ['my_feature_flag_1', 'my_feature_flag_2'] }, // will fetch feature flags named 'my_feature_flag_1' and 'my_feature_flag_2'
       *  ]`
       * @property {SplitFilter[]} splitFilters
       */
      splitFilters?: SplitFilter[]
      /**
       * Feature Flag Spec version. Option to determine which version of the feature flag definitions are fetched and stored.
       * Possible values are '1.0' and '1.1'.
       *
       * @default '1.1'
       */
      flagSpecVersion?: '1.0' | '1.1'
      /**
       * Impressions Collection Mode. Option to determine how impressions are going to be sent to Split Servers.
       *
       * Possible values are 'DEBUG' and 'OPTIMIZED'.
       * - DEBUG: will send all the impressions generated (recommended only for debugging purposes).
       * - OPTIMIZED: will send unique impressions to Split Servers avoiding a considerable amount of traffic that duplicated impressions could generate.
       *
       * @property {String} impressionsMode
       * @default 'OPTIMIZED'
       */
      impressionsMode?: ImpressionsMode
    }
    /**
     * Scheduler settings.
     * @property {Object} scheduler
     */
    scheduler?: {
      /**
       * Maximum number of impressions to send per POST request.
       * @property {number} impressionsPerPost
       * @default 1000
       */
      impressionsPerPost?: number
      /**
       * Maximum number of events to send per POST request.
       * @property {number} eventsPerPost
       * @default 1000
       */
      eventsPerPost?: number
      /**
       * Maximum number of retry attempts for posting impressions and events.
       * @property {number} maxRetries
       * @default 3
       */
      maxRetries?: number
    }
  }
}
