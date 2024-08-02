import { StoredImpressionWithMetadata } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { ImpressionDTO } from '@splitsoftware/splitio-commons/src/types';
import { _getRandomString } from './commonUtils';

/**
 * An Impression example.
 */
const impressionFullNameNoMetadata: ImpressionDTO = {
  keyName: 'marcio@split.io',
  bucketingKey: 'impr_bucketing_2',
  feature: 'qc_team',
  treatment: 'no',
  label: 'default rule',
  changeNumber: 828282828282,
  time: Date.now(),
};
/**
 * An Impression with Metadata example.
 */
const impressionWithMetadata: StoredImpressionWithMetadata = {
  m: {
    s: 'go-6.1.0',
    i: '192.168.0.6',
    n: 'ip-192-168-0-6',
  },
  i: {
    f: 'qc_team',
    k: 'marcio@split.io',
    t: 'no',
    m: Date.now(),
    b: 'impr_bucketing_2',
    r: 'default rule',
    c: 828282828282,
  },
};
/**
 * Function go return an Impression with a Random generated metadata.
 *
 * @returns {StoredImpressionWithMetadata}
 */
function getRandomiseMetadata(): StoredImpressionWithMetadata {
  const { i, s } = impressionWithMetadata.m;
  return Object.assign(
    {},
    impressionWithMetadata,
    { m: { n: _getRandomString(14), i, s } }
  );
}
/**
 * Function generate a random value for the "value" in an example impression,
 * and then return that Impression.
 *
 * @returns {StoredImpressionWithMetadata}
 */
function getRandomiseImpression(): StoredImpressionWithMetadata {
  const { k, t, m, b, r, c } = impressionWithMetadata.i;
  return Object.assign(
    {},
    impressionWithMetadata,
    { i: { k, t, m, b, r, c, f: _getRandomString(12) } }
  );
}
/**
 * Function to return an Impression with its full Key's name and no metadata.
 *
 * @returns {ImpressionDTO}
 */
export function getImpressionSampleWithNoMetadata(): ImpressionDTO {
  return impressionFullNameNoMetadata;
}
/**
 *  Function to generate a list of Impressions with the same metadata.
 *
 * @param {number}  len        The amount of Impressions to generate.
 * @param {boolean} randomiseMetadata    Flag to determine if Metadata needs to be randomly generated.
 * @param {boolean} randomiseImpression  Flag to determine if Impression data needs to be randomly generated.
 * @returns {StoredImpressionWithMetadata[]}
 */
export function getImpressionsListWithSameMetadata(
  len: number,
  randomiseMetadata = false,
  randomiseImpression = false
): StoredImpressionWithMetadata[] {
  const _impressionTarget = {
    m: randomiseMetadata ? getRandomiseMetadata().m : impressionWithMetadata.m,
    i: randomiseImpression ? getRandomiseImpression().i : impressionWithMetadata.i,
  };

  return [...Array(len).keys()].map(() => _impressionTarget);
}


