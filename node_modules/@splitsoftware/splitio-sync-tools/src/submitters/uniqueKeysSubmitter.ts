/* eslint-disable max-len */
import { ILogger } from '@splitsoftware/splitio-commons/src/logger/types';
import { IPostUniqueKeysBulkSs } from '@splitsoftware/splitio-commons/src/services/types';
import { fromUniqueKeysCollector } from '@splitsoftware/splitio-commons/src/storages/inMemory/UniqueKeysCacheInMemory';
import { UniqueKeysCachePluggable } from '@splitsoftware/splitio-commons/src/storages/pluggable/UniqueKeysCachePluggable';
import { ISet, _Set } from '@splitsoftware/splitio-commons/src/utils/lang/sets';
import { submitterFactory } from './submitter';

export function uniqueKeysSubmitterFactory(
  logger: ILogger,
  postClient: IPostUniqueKeysBulkSs,
  uniqueKeysCache: UniqueKeysCachePluggable,
  maxRetries?: number,
  uniqueKeysFetchSize?: number,
): () => Promise<boolean> {

  async function getPayload() {
    const uniqueKeyItems = await uniqueKeysCache.popNRaw(uniqueKeysFetchSize);

    if (!uniqueKeyItems.length) return undefined;

    const mergedUniqueKeys = uniqueKeyItems.reduce<{ [featureName: string]: ISet<string> }>((accUniqueKeys, uniqueKeyItem) => {
      const featureNameKeys = accUniqueKeys[uniqueKeyItem.f];
      if (featureNameKeys) {
        uniqueKeyItem.ks.forEach(key => featureNameKeys.add(key));
      } else {
        accUniqueKeys[uniqueKeyItem.f] = new _Set(uniqueKeyItem.ks);
      }
      return accUniqueKeys;
    }, {});

    return fromUniqueKeysCollector(mergedUniqueKeys);
  }

  return submitterFactory(logger, postClient, getPayload, 'unique keys', maxRetries);
}
