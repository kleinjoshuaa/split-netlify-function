
import { IPostTestImpressionsCount } from '@splitsoftware/splitio-commons/src/services/types';
import { fromImpressionCountsCollector } from '@splitsoftware/splitio-commons/src/sync/submitters/impressionCountsSubmitter';
import { ImpressionCountsCacheInMemory } from '@splitsoftware/splitio-commons/src/storages/inMemory/ImpressionCountsCacheInMemory';
import { ILogger } from '@splitsoftware/splitio-commons/src/logger/types';
import { ImpressionCountsCachePluggable } from '@splitsoftware/splitio-commons/src/storages/pluggable/ImpressionCountsCachePluggable';
import { submitterFactory } from './submitter';
import { ImpressionCountsPayload } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { _Map } from '@splitsoftware/splitio-commons/src/utils/lang/maps';

// Merge impressions counts objects
function merge(counts1: ImpressionCountsPayload, counts2: ImpressionCountsPayload): ImpressionCountsPayload {
  const merged = new _Map(counts1.pf.map((count) => [count.f + count.m, count]));
  counts2.pf.forEach((count) => {
    const key = count.f + count.m;
    if (merged.has(key)) merged.get(key)!.rc += count.rc;
    else merged.set(key, count);
  }
  );

  const pf: ImpressionCountsPayload['pf'] = [];
  merged.forEach((count) => pf.push(count));
  return { pf };
}

export function impressionCountsSubmitterFactory(
  logger: ILogger,
  postClient: IPostTestImpressionsCount,
  impressionCountsCache: ImpressionCountsCachePluggable,
  maxRetries?: number,
  impressionCountsCacheInMemory?: ImpressionCountsCacheInMemory,
): () => Promise<boolean> {

  async function getPayload() {
    let result = await impressionCountsCache.getImpressionsCount();

    // Get impression counts from the in-memory cache available when Synchronizer runs in OPTIMIZED impressions mode
    // and merge with the ones from pluggable storage.
    if (impressionCountsCacheInMemory) {
      const impressionCountsData = impressionCountsCacheInMemory.pop();
      const memoryCounts = Object.keys(impressionCountsData).length > 0 ?
        fromImpressionCountsCollector(impressionCountsData) :
        undefined;

      if (memoryCounts) result = result ? merge(result, memoryCounts) : memoryCounts;
    }

    return result;
  }

  return submitterFactory(logger, postClient, getPayload, 'impression counts', maxRetries);
}
