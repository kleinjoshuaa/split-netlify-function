import { IMetadata } from '@splitsoftware/splitio-commons/src/dtos/types';

const DEFAULT_RETRIES_AMOUNT = 3;

/**
 * Function to generate the Metadata Headers required for Impressions and Events POST requests.
 *
 * @param {IMetadata} metadata  The object containing the Metadata SDK Version, IP and Machine name.
 * @returns {{ SplitSDKVersion: string, SplitSDKMachineIP: string, SplitSDKMachineName: string }}
 */
export const metadataToHeaders = (metadata: IMetadata): {
  SplitSDKVersion: string;
  SplitSDKMachineIP: string;
  SplitSDKMachineName: string;
} => {
  return { SplitSDKVersion: metadata.s, SplitSDKMachineIP: metadata.i, SplitSDKMachineName: metadata.n };
};
/**
 * Function to process a list of Objects, and group them by any unique key that is defined on
 * demand when executing the function. It returns a Map with -n array of elements grouped
 * by the desired key.
 *
 * @param {Array<any>} listOfElements  The Array of Objects to process.
 * @param {string}     objectKey       The Key name to define how to group the list of elements.
 * @returns {any}
 */
export function groupBy<T>(listOfElements: Array<T>, objectKey: string):
  {[metadataAsKey: string]: Array<T>} {
  const _resultMap: any = {};

  listOfElements.forEach((e) => { // @ts-ignore
    const metadataKey = JSON.stringify(e[objectKey]);
    if (!_resultMap[metadataKey]) _resultMap[metadataKey] = [];
    _resultMap[metadataKey].push(e);
  });

  return _resultMap;
}
/**
 * Retries a async function recursively n times.
 *
 * @param {Function}    fn       The function to attempt retry.
 * @param {number}      retries  The amount of attempts to retries. Default 3.
 * @param {string|null} err      A custom error message to display when error.
 * @returns {Promise}
 */
export function retry(
  fn: () => any,
  retries: number = DEFAULT_RETRIES_AMOUNT,
  err: string | null = null
): Promise<any> {
  if (retries === 0) {
    return Promise.reject(err);
  }
  return fn().catch((err: string) => {
    return retry(fn, (retries - 1), err);
  });
}
