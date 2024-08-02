import { UniqueKeysItemSs, UniqueKeysPayloadSs } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { uniqueKeysSubmitterFactory } from '../uniqueKeysSubmitter';
import { noopLogger } from './commonUtils';

describe('Unique keys submitter', () => {
  const postUniqueKeysBulkSsMock = jest.fn(() => Promise.resolve());
  const uniqueKeysCacheMock = { popNRaw: jest.fn() };

  // @ts-ignore
  const uniqueKeysSubmitter = uniqueKeysSubmitterFactory(noopLogger, postUniqueKeysBulkSsMock, uniqueKeysCacheMock);

  beforeEach(() => {
    postUniqueKeysBulkSsMock.mockClear();
    uniqueKeysCacheMock.popNRaw.mockClear();
  });

  test('If there isn\'t unique keys data, do nothing', async () => {
    uniqueKeysCacheMock.popNRaw = jest.fn(() => Promise.resolve([]));

    await uniqueKeysSubmitter();

    expect(postUniqueKeysBulkSsMock).not.toHaveBeenCalled();
    expect(uniqueKeysCacheMock.popNRaw).toHaveBeenCalledTimes(1);
  });

  test('If there is unique keys data, POST it', async () => {
    uniqueKeysCacheMock.popNRaw = jest.fn(() => Promise.resolve<UniqueKeysItemSs[]>([
      { f: 'f1', ks: ['k1', 'k2'] },
      { f: 'f2', ks: ['k1', 'k1'] },
      { f: 'f1', ks: ['k3', 'k2'] },
    ]));

    await uniqueKeysSubmitter();

    const expectedPayload: UniqueKeysPayloadSs = {
      keys: [
        { f: 'f1', ks: ['k1', 'k2', 'k3'] },
        { f: 'f2', ks: ['k1'] },
      ],
    };
    expect(postUniqueKeysBulkSsMock.mock.calls).toEqual([
      [JSON.stringify(expectedPayload)],
    ]);
    expect(uniqueKeysCacheMock.popNRaw).toHaveBeenCalledTimes(1);
  });

});
