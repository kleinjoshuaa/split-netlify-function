import { splitApiFactory } from '@splitsoftware/splitio-commons/src/services/splitApi';
import { IFetch, ISplitApi } from '@splitsoftware/splitio-commons/src/services/types';
import { IStorageAsync, ITelemetryCacheAsync } from '@splitsoftware/splitio-commons/src/storages/types';
import { ISettings } from '@splitsoftware/splitio-commons/src/types';
import { SegmentsSynchronizer } from './synchronizers/SegmentsSynchronizer';
import { SplitsSynchronizer } from './synchronizers/SplitsSynchronizer';
import { synchronizerStorageFactory } from './storages/synchronizerStorage';
import { eventsSubmitterFactory } from './submitters/eventsSubmitter';
import { impressionsSubmitterFactory } from './submitters/impressionsSubmitter';
import { impressionObserverSSFactory } from '@splitsoftware/splitio-commons/src/trackers/impressionObserver/impressionObserverSS';
import { ImpressionCountsCacheInMemory } from '@splitsoftware/splitio-commons/src/storages/inMemory/ImpressionCountsCacheInMemory';
import { ImpressionObserver } from '@splitsoftware/splitio-commons/src/trackers/impressionObserver/ImpressionObserver';
import { telemetryTrackerFactory } from '@splitsoftware/splitio-commons/src/trackers/telemetryTracker';
import { impressionCountsSubmitterFactory } from './submitters/impressionCountsSubmitter';
import { synchronizerSettingsValidator } from './settings';
import { validateApiKey } from '@splitsoftware/splitio-commons/src/utils/inputValidation';
import { ISynchronizerSettings } from '../types';
import { InMemoryStorageFactory } from '@splitsoftware/splitio-commons/src/storages/inMemory/InMemoryStorage';
import { IEventsCacheAsync } from '@splitsoftware/splitio-commons/src/storages/types';
import { IImpressionsCacheAsync } from '@splitsoftware/splitio-commons/src/storages/types';
import { telemetrySubmitterFactory } from './submitters/telemetrySubmitter';
import { uniqueKeysSubmitterFactory } from './submitters/uniqueKeysSubmitter';
import { UniqueKeysCachePluggable } from '@splitsoftware/splitio-commons/src/storages/pluggable/UniqueKeysCachePluggable';
import { ImpressionCountsCachePluggable } from '@splitsoftware/splitio-commons/src/storages/pluggable/ImpressionCountsCachePluggable';
/**
 * Main class to handle the Synchronizer execution.
 */
export class Synchronizer {
  /**
   * The local reference to the Synchronizer's Storage.
   */
  private _storage!: IStorageAsync;
  /**
   * The local reference to the Synchronizer's SplitAPI instance.
   */
  private _splitApi: ISplitApi;
  /**
   * The local reference to the SegmentsUpdater instance from @splitio/javascript-commons.
   */
  private _segmentsSynchronizer!: SegmentsSynchronizer;
  /**
   * The local reference to the SplitUpdater instance from @splitio/javascript-commons.
   */
  private _splitsSynchronizer!: SplitsSynchronizer;
  /**
   * The local reference to the EventsSynchronizer class.
   */
  private _eventsSubmitter!: () => Promise<boolean>;
  /**
   * The local reference to the ImpressionsSynchronizer class.
   */
  private _impressionsSubmitter!: () => Promise<boolean>;
  /**
   * The local reference to the ImpressionsCountSynchronizer class.
   */
  private _impressionCountsSubmitter?: () => Promise<boolean>;
  /**
   * The local reference to the unique keys submitter.
   */
  private _uniqueKeysSubmitter?: () => Promise<boolean>;
  /**
   * The local reference to the telemetry submitter.
   */
  private _telemetrySubmitter?: () => Promise<boolean>;

  /**
   * The local reference to the Synchronizer's settings configurations.
   */
  settings: ISettings & ISynchronizerSettings;
  /**
   * The local reference for the Impression Observer.
   */
  private _observer: ImpressionObserver;

  /**
   * @param  {ISynchronizerSettings} config  Configuration object used to instantiates the Synchronizer.
   */
  constructor(config: ISynchronizerSettings) {
    this._observer = impressionObserverSSFactory();
    const settings = synchronizerSettingsValidator(config);

    if (!validateApiKey(settings.log, settings.core.authorizationKey)) {
      throw new Error('Unable to initialize Synchronizer task: invalid SDK key.');
    }

    this.settings = settings;
    /**
     * The Split's HTTPclient, required to make the requests to the API.
     */
    this._splitApi = splitApiFactory(
      this.settings,
      { getFetch: Synchronizer._getFetch },
      telemetryTrackerFactory() // no-op telemetry tracker
    );
  }

  /**
   * Function to check the health status of Split APIs (SDK and Events services).
   *
   * @returns {Promise<boolean>}
   */
  private async _checkEndpointHealth() {
    return await Promise.all([
      this._splitApi.getSdkAPIHealthCheck(),
      this._splitApi.getEventsAPIHealthCheck(),
    ]).then((results) => results.every((result) => result));
  }
  /**
   * Function to set a storage.
   *
   * @returns {Promise<void>} A Promise that resolves when the storage is ready. It can reject if the storage is not properly configured (e.g., invalid wrapper) or the wrapper fails to connect.
   */
  private initializeStorage(): Promise<void> {
    return new Promise<void>((res, rej) => {
      // @ts-ignore
      this._storage = synchronizerStorageFactory(
        this.settings,
        (error) => error ? rej(error) : res()
      );
    }).catch((error) => {
      throw new Error(`Error when connecting storage. ${error}`);
    });
  }
  /**
   * Function to set all the required Synchronizers.
   */
  private initializeSynchronizers() {
    // @todo: Add Cli paramater to define impressionsMode.
    const countsCache = this.settings.sync.impressionsMode === 'OPTIMIZED' ?
      new ImpressionCountsCacheInMemory() :
      undefined;

    this._segmentsSynchronizer = new SegmentsSynchronizer(
      this._splitApi.fetchSegmentChanges,
      this.settings,
      this._storage.segments,
    );
    this._splitsSynchronizer = new SplitsSynchronizer(
      this._splitApi.fetchSplitChanges,
      this.settings,
      this._storage.splits,
      this._storage.segments,
      // @ts-ignore
      InMemoryStorageFactory({ settings: this.settings }),
      // @ts-ignore
      InMemoryStorageFactory({ settings: this.settings })
    );
    this._eventsSubmitter = eventsSubmitterFactory(
      this.settings.log,
      this._splitApi.postEventsBulk,
      this._storage.events as IEventsCacheAsync,
      this.settings.scheduler.eventsPerPost,
      this.settings.scheduler.maxRetries,
    );
    this._impressionsSubmitter = impressionsSubmitterFactory(
      this.settings.log,
      this._splitApi.postTestImpressionsBulk,
      this._storage.impressions as IImpressionsCacheAsync,
      this._observer,
      this.settings.scheduler.impressionsPerPost,
      this.settings.scheduler.maxRetries,
      countsCache,
    );
    this._impressionCountsSubmitter = impressionCountsSubmitterFactory(
      this.settings.log,
      this._splitApi.postTestImpressionsCount,
      this._storage.impressionCounts as ImpressionCountsCachePluggable, // ATM we are ignoring counts from `countsCache` and only sending the ones from the storage.
      this.settings.scheduler.maxRetries,
      countsCache,
    );
    this._uniqueKeysSubmitter = uniqueKeysSubmitterFactory(
      this.settings.log,
      this._splitApi.postUniqueKeysBulkSs,
      this._storage.uniqueKeys as UniqueKeysCachePluggable,
      this.settings.scheduler.maxRetries,
    );
    this._telemetrySubmitter = telemetrySubmitterFactory(
      this.settings.log,
      this._splitApi,
      this._storage.telemetry as ITelemetryCacheAsync,
    );
  }
  /**
   * Function to prepare for sync tasks. Checks for Fetch API availability and initialize Syncs and Storages.
   *
   * @returns {Promise<void>} A promise that resolves if the synchronizer is ready to execute. It rejects with an error,
   * for example, if the Fetch API is not available, Split API is not responding, or Storage connection fails.
   */
  private async preExecute(): Promise<void> {
    const log = this.settings.log;
    if (!Synchronizer._getFetch()) throw new Error('Global Fetch API is not available');
    log.info('Synchronizer: Execute');

    const areAPIsReady = await this._checkEndpointHealth();
    if (!areAPIsReady) throw new Error('Health check of Split API endpoints failed');
    log.info('Split API ready');

    await this.initializeStorage();

    log.info('Storage setup ready');

    this.initializeSynchronizers();
  }
  /**
   * Function to wrap actions to perform after the sync tasks have been executed.
   * Currently, it disconects from the Storage.
   *
   * @returns {Promise<void>} A promise that resolves if the synchronizer has successfully disconnected from the storage. Otherwise, it rejects with an error.
   */
  private async postExecute(): Promise<void> {
    try {
      await this._storage.destroy();
    } catch (error) {
      throw new Error(`Error when disconnecting storage. ${error}`);
    }
  }
  /**
   * Method to start the Synchronizer execution.
   *
   * @param {Function?} cb Optional error-first callback to be invoked when the synchronization ends. The callback will be invoked with an error as first argument if the synchronization fails.
   * @returns {Promise<boolean>}
   */
  async execute(cb?: (err?: any) => void): Promise<boolean> {
    try {
      // @ts-ignore @TODO define synchronizerMode config param
      const mode = this.settings.scheduler.synchronizerMode || 'MODE_RUN_ALL';

      await this.preExecute();

      let errorMessage;
      if (mode === 'MODE_RUN_ALL' || mode === 'MODE_RUN_FEATURE_FLAGS_AND_SEGMENTS') {
        if (!await this.executeSplitsAndSegments(false)) errorMessage = 'Feature flags and/or segments synchronization failed';
      }
      if (mode === 'MODE_RUN_ALL' || mode === 'MODE_RUN_EVENTS_AND_IMPRESSIONS') {
        if (!await this.executeImpressionsAndEvents(false)) errorMessage = 'Impressions and/or events synchronization failed';
      }

      // Disconnect from storage before throwing synchronization error
      await this.postExecute();
      if (errorMessage) throw new Error(errorMessage);

      this.settings.log.info('Synchronizer: Execution ended successfully');
      cb && cb();
      return true;
    } catch (error) {
      this.settings.log.error(`Synchronizer: Execution ended unsuccessfully with error: ${error}`);
      cb && cb(error);
      return false;
    }
  }
  // @TODO remove standalone param for cleaner code
  /**
   * Function to wrap the execution of the feature flags and segments synchronizers.
   *
   * @param {boolean} standalone  Flag to determine the function requires the preExecute conditions.
   * @returns {Promise<boolean>} A promise that resolves to a boolean value indicating if feature flags and segments were successfully fetched and stored.
   */
  private async executeSplitsAndSegments(standalone = true) {
    if (standalone) await this.preExecute();

    // @TODO optimize SplitChangesUpdater to reduce storage operations ("inMemoryOperation" mode)
    const isSplitsSyncSuccessfull = await this._splitsSynchronizer.getSplitChanges();

    this.settings.log.debug(`Feature flags Synchronizer task: ${isSplitsSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);
    const isSegmentsSyncSuccessfull = await this._segmentsSynchronizer.getSegmentsChanges();
    this.settings.log.debug(`Segments Synchronizer task: ${isSegmentsSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);

    if (standalone) await this.postExecute();

    return isSplitsSyncSuccessfull && isSegmentsSyncSuccessfull;
  }
  /**
   * Function to wrap the execution of the Impressions and Event's synchronizers.
   *
   * @param {boolean} standalone  Flag to determine the function requires the preExecute conditions.
   * @returns {Promise<boolean>} A promise that resolves to a boolean value indicating if impressions and events were successfully popped from the storage and sent to Split.
   */
  private async executeImpressionsAndEvents(standalone = true) {
    const log = this.settings.log;
    if (standalone) await this.preExecute();

    const isEventsSyncSuccessfull = await this._eventsSubmitter();
    log.debug(`Events Synchronizer task: ${isEventsSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);
    const isImpressionsSyncSuccessfull = await this._impressionsSubmitter();
    log.debug(`Impressions Synchronizer task: ${isImpressionsSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);

    let isSyncSuccessfull = isEventsSyncSuccessfull && isImpressionsSyncSuccessfull;

    if (this._impressionCountsSubmitter) {
      const isImpressionCountsSyncSuccessfull = await this._impressionCountsSubmitter();
      isSyncSuccessfull = isSyncSuccessfull && isImpressionCountsSyncSuccessfull;
      log.debug(`ImpressionCounts Synchronizer task: ${isImpressionCountsSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);
    }

    if (this._uniqueKeysSubmitter) {
      const isUniqueKeysSyncSuccessfull = await this._uniqueKeysSubmitter();
      isSyncSuccessfull = isSyncSuccessfull && isUniqueKeysSyncSuccessfull;
      log.debug(`UniqueKeys Synchronizer task: ${isUniqueKeysSyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);
    }

    if (this._telemetrySubmitter) {
      const isTelemetrySyncSuccessfull = await this._telemetrySubmitter();
      // if telemetry sync fails, we don't return false, since it's not a critical operation
      log.debug(`Telemetry Synchronizer task: ${isTelemetrySyncSuccessfull ? 'Successful' : 'Unsuccessful'}`);
    }

    return isSyncSuccessfull;
  }
  /**
   * Function to set the Fetch function to perform the requests. It can be provided through
   * the NPM package, or fallbacks to the global Fetch function if available. In case
   * there is no fetch globally, returns undefined.
   *
   * @returns {IFetch|undefined}
   */
  static _getFetch(): IFetch | undefined {
    let _fetch;
    try {
      _fetch = require('node-fetch');
      // Handle node-fetch issue https://github.com/node-fetch/node-fetch/issues/1037
      if (typeof _fetch !== 'function') _fetch = _fetch.default;
    } catch (e) {
      // Try to access global fetch if `node-fetch` package couldn't be imported (e.g., not in a Node environment)
      // eslint-disable-next-line no-undef
      _fetch = typeof fetch === 'function' ? fetch : undefined;
    }
    return _fetch;
  }
}
