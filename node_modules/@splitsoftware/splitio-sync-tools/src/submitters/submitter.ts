import { ILogger } from '@splitsoftware/splitio-commons/src/logger/types';
import { IResponse } from '@splitsoftware/splitio-commons/src/services/types';
import { IRecorderCacheAsync } from '@splitsoftware/splitio-commons/src/storages/types';
import { retry } from './utils';

// Base submitter factory for impressions and events submitters, which must handle metadata
export function submitterWithMetadataFactory<T>(
  logger: ILogger,
  postClient: (body: string, headers?: Record<string, string>) => Promise<IResponse>,
  sourceCache: IRecorderCacheAsync<T>,
  dataName: string,
  itemsPerPost: number,
  fromCacheToPayload: (cacheData: T) => { payload: any, headers?: Record<string, string> }[],
  maxRetries?: number,
): () => Promise<boolean> {

  return function postData(): Promise<boolean> {
    return sourceCache.popNWithMetadata(itemsPerPost).then(async (cacheData) => {
      const data = fromCacheToPayload(cacheData);

      // POST data with retry attempts
      try {
        for (let i = 0; i < data.length; i++) {
          const { payload, headers } = data[i];
          await retry(
            () => postClient(JSON.stringify(payload), headers),
            maxRetries
          );
        }
        logger.info(`Successfully submitted ${dataName} to Split`);
      } catch (err) {
        logger.error(`An error occurred while submitting ${dataName} to Split: ${err}`);
        return false;
      }

      // If more data is available, post it.
      const count = await sourceCache.count();
      return count > 0 ? postData() : true;
    })
      .catch((e) => {
        logger.error(`An error occurred while retrieving ${dataName} from storage: ${e}`);
        return false;
      });
  };
}

// Base submitter factory for impression counts and unique keys submitters
export function submitterFactory(
  logger: ILogger,
  postClient: (body: string, headers?: Record<string, string>) => Promise<IResponse>,
  getPayload: () => any,
  dataName: string,
  maxRetries?: number,
): () => Promise<boolean> {

  return async function postData() {
    let payload: any;

    try {
      payload = await getPayload();
    } catch (e) {
      logger.error(`An error occurred when retrieving ${dataName} from storage: ${e}`);
      return false;
    }

    if (payload) {
      // POST data with retry attempts
      try {
        await retry(
          () => postClient(JSON.stringify(payload)),
          maxRetries
        );
        logger.info(`Successfully submitted ${dataName} to Split.`);
      } catch (err) {
        logger.error(`An error occurred while submitting ${dataName} to Split: ${err}`);
        return false;
      }
    }

    return true;
  };
}
