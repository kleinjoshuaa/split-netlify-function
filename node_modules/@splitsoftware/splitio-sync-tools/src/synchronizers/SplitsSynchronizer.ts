import { IFetchSplitChanges } from '@splitsoftware/splitio-commons/src/services/types';
import { splitChangesFetcherFactory } from '@splitsoftware/splitio-commons/src/sync/polling/fetchers/splitChangesFetcher';
import { splitChangesUpdaterFactory } from '@splitsoftware/splitio-commons/src/sync/polling/updaters/splitChangesUpdater';
import { ISettings } from '@splitsoftware/splitio-commons/src/types';
import { ISplit } from '@splitsoftware/splitio-commons/src/dtos/types';
import { ISegmentsCacheAsync, ISplitsCacheAsync, IStorageSync } from '@splitsoftware/splitio-commons/src/storages/types';

type ISplitChangesUpdater = (noCache?: boolean) => Promise<boolean>;

/**
 * Class that manages the synchronization of feature flags.
 */
export class SplitsSynchronizer {
  /**
   * The local reference to the Synchronizer's Split Storage.
   */
  private _segmentsStorage;
  /**
   * The local reference to the Synchronizer's Segments Storage.
   */
  private _splitsStorage;
  /**
   * The local reference to the Fetch implementation required to perform requests.
   */
  private _fetcher;
  /**
   * The local reference to the SplitUpdater from @splitio/javascript-commons.
   */
  private _splitUpdater?: ISplitChangesUpdater;
  /**
   * The local reference to the Synchronizer's settings configurations.
   */
  private _settings;
  /*
   * @todo: Implement Event Emitter param from splitUpdater and segmentsUpdater to calculate the
   *        differences between both storage.
   */
  /**
   * The local reference to the InMemory cache used when InMemoryOperation mode is enabled.
   */
  _inMemoryStorage: IStorageSync;
  /**
   * The local reference to the InMemory cache initial Snapshot used when InMemoryOperation mode is enabled to detect
   * differences between the current Storage's data with the InMemory updated data post synchronization.
   */
  _inMemoryStorageSnapshot: IStorageSync;

  /**
   * @param {IFetchSplitChanges}   splitFetcher     The SplitChanges fetcher from Split API.
   * @param {ISettings}            settings         The Synchronizer's settings.
   * @param {ISplitsCacheAsync}    splitsStorage    The reference to the current Split Storage.
   * @param {ISegmentsCacheAsync}  segmentsStorage  The reference to the current Cache Storage.
   * @param {IStorageSync}  inMemoryStorage  The reference to the current Cache Storage.
   * @param {IStorageSync}  inMemoryStorageSnapshot  The reference to the current Cache Storage.
   */
  constructor(
    splitFetcher: IFetchSplitChanges,
    settings: ISettings,
    splitsStorage: ISplitsCacheAsync,
    segmentsStorage: ISegmentsCacheAsync,
    inMemoryStorage: IStorageSync,
    inMemoryStorageSnapshot: IStorageSync,
  ) {
    this._splitsStorage = splitsStorage;
    this._segmentsStorage = segmentsStorage;
    this._settings = settings;
    this._fetcher = splitChangesFetcherFactory(splitFetcher);
    this._splitUpdater = undefined;
    this._inMemoryStorage = inMemoryStorage;
    this._inMemoryStorageSnapshot = inMemoryStorageSnapshot;
  }

  /**
   * Function to use the SplitUpdater, in order to fetch and store feature flags from the BE.
   *
   * @returns {Promise<boolean>}
   */
  getSplitChanges(): Promise<boolean> {
    this._splitUpdater = splitChangesUpdaterFactory(
      this._settings.log,
      this._fetcher,
      this._splitsStorage,
      this._segmentsStorage,
      this._settings.sync.__splitFiltersValidation,
    );
    return this._splitUpdater();
  }
  /**
   * Method to retrieve feature flags from external Storage and transfer to local InMemory cache.
   *
   * @param {SplitsCacheInMemory} splitCacheInMemory  Reference to the local InMemoryCache.
   */
  async getDataFromStorage() {
    const _splitsList: [string, ISplit][] = [];
    try {
      const splits = await this._splitsStorage.getAll();

      splits.forEach((split) => {
        _splitsList.push([split.name, split]);
      });

      this._inMemoryStorage.splits.addSplits(_splitsList);

      this._inMemoryStorageSnapshot.splits.addSplits(_splitsList);

      const registeredSegments = await this._segmentsStorage.getRegisteredSegments();
      if (registeredSegments.length > 0) {
        this._inMemoryStorage.segments.registerSegments(registeredSegments);
        this._inMemoryStorageSnapshot.segments.registerSegments(registeredSegments);
      }
      const changeNumber = await this._splitsStorage.getChangeNumber();

      this._inMemoryStorage.splits.setChangeNumber(changeNumber);
      this._inMemoryStorageSnapshot.splits.setChangeNumber(changeNumber);

    } catch (error) {
      this._settings.log.error(
        `Feature flags InMemory synchronization: Error when retreving data from external Storage. Error: ${error}`
      );
    }
  }

  /**
   * Function to store feature flags from InMemory cache to the provided external Storage.
   */
  async putDataToStorage() {
    try {
      const snapshotChangeNumber = this._inMemoryStorageSnapshot?.splits.getChangeNumber();
      const changeNumber = this._inMemoryStorage?.splits.getChangeNumber();

      if (snapshotChangeNumber === changeNumber) return;

      const diffResult = await this.processDifferences();

      if (diffResult > 0) this._settings.log.info(`Removed ${diffResult} feature flags from storage`);
      const splits = this._inMemoryStorage.splits.getAll() || [];

      if (splits.length > 0) {

        const splitsToStore: [string, ISplit][] = [];
        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];
          const { name, changeNumber } = split;
          const oldSplitDefinition = this._inMemoryStorageSnapshot.splits.getSplit(name);

          if (split) {
            // If the feature flag doesn't exists.
            if (!oldSplitDefinition) {
              splitsToStore.push([name, split]);
              continue;
            }
            // If the feature flag exists and needs to be updated.
            if (oldSplitDefinition.changeNumber !== changeNumber) {
              splitsToStore.push([name, split]);
              continue;
            }
          }
        }

        await this._splitsStorage.addSplits(splitsToStore);
      }
      await this._splitsStorage.setChangeNumber(changeNumber);

      const registeredSegments = this._inMemoryStorage.segments.getRegisteredSegments();

      // @todo: Update segment definitions and change number
      if (registeredSegments.length > 0)
        await this._segmentsStorage.registerSegments(registeredSegments);
    } catch (error) {
      this._settings.log.error(
        `Feature flags InMemory synchronization: Error when storing data to external Storage. Error: ${error}`
      );
    }
  }

  /**
   * Function to use the InMemoryCache to execute the SplitUpdater to fetch and store feature flags
   * from the BE.
   *
   * @returns {Promise<boolean>}
   */
  async getSplitChangesInMemory(): Promise<boolean> {
    this._splitUpdater = splitChangesUpdaterFactory(
      this._settings.log,
      this._fetcher,
      this._inMemoryStorage.splits,
      this._inMemoryStorage.segments,
      this._settings.sync.__splitFiltersValidation,
    );
    try {
      this._settings.log.info('InMemoryOperation config enabled.');
      await this.getDataFromStorage();

      const res = await this._splitUpdater();
      if (!res) {
        return Promise.resolve(false);
      }
      await this.putDataToStorage();
      return res;
    } catch (error) {
      this._settings.log.error(`Error executing feature flags synchronization with InMemory cache. ${error}`);
      return Promise.resolve(false);
    }
  }
  /**
   * Function to compare an inital InMemory cache snapshot with the updated InMemory cache after synchronization.
   * It will calculate differences, removing feature flags that are no longer required and updating the ones with new data.
   *
   * @returns {any}
   */
  async processDifferences() {
    let deletedAmount = 0;
    const oldSplitsKeys = this._inMemoryStorageSnapshot.splits.getSplitNames() || [];
    const newSplitsKeys = this._inMemoryStorage.splits.getSplitNames() || [];
    const splitKeysToRemove: string[] = [];

    oldSplitsKeys.forEach((key) => {
      const splitName = key;

      if (!newSplitsKeys.some((k) => k === splitName)) {
        splitKeysToRemove.push(splitName);
        deletedAmount++;
      }
    });

    await this._splitsStorage.removeSplits(splitKeysToRemove);

    return deletedAmount;
  }
}
