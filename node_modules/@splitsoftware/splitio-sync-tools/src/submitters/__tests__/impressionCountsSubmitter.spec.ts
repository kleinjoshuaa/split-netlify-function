/* eslint-disable max-len */
import { ImpressionCountsPayload } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { impressionCountsSubmitterFactory } from '../impressionCountsSubmitter';
import { noopLogger } from './commonUtils';

describe('Impression counts submitter', () => {
  const postTestImpressionsCountMock = jest.fn(() => Promise.resolve());
  const impressionCountsCacheMock = { getImpressionsCount: jest.fn() };
  const expectedPayload: ImpressionCountsPayload = {
    pf: [
      { f: 'f1', m: 1, rc: 4 },
      { f: 'f2', m: 2, rc: 8 },
    ],
  };

  // @ts-ignore
  const impressionCountsSubmitter = impressionCountsSubmitterFactory(noopLogger, postTestImpressionsCountMock, impressionCountsCacheMock);

  beforeEach(() => {
    postTestImpressionsCountMock.mockClear();
    impressionCountsCacheMock.getImpressionsCount.mockClear();
  });

  test('If there isn\'t impression counts data, do nothing', async () => {
    impressionCountsCacheMock.getImpressionsCount.mockImplementation(() => Promise.resolve());

    await impressionCountsSubmitter();

    expect(postTestImpressionsCountMock).not.toHaveBeenCalled();
    expect(impressionCountsCacheMock.getImpressionsCount).toHaveBeenCalledTimes(1);
  });

  test('If there is impression counts data in pluggable cache, POST it', async () => {

    impressionCountsCacheMock.getImpressionsCount.mockImplementation(() => Promise.resolve(expectedPayload));

    await impressionCountsSubmitter();

    expect(postTestImpressionsCountMock.mock.calls).toEqual([
      [JSON.stringify(expectedPayload)],
    ]);
    expect(impressionCountsCacheMock.getImpressionsCount).toHaveBeenCalledTimes(1);
  });

  test('If there is impression counts data in memory cache, POST it', async () => {
    impressionCountsCacheMock.getImpressionsCount.mockImplementation(() => Promise.resolve());
    const impressionCountsCacheInMemoryMock = {
      pop: jest.fn(() => ({
        'f1::1': 4,
        'f2::2': 8,
      })),
    };

    // @ts-ignore
    const impressionCountsSubmitter = impressionCountsSubmitterFactory(noopLogger, postTestImpressionsCountMock, impressionCountsCacheMock, undefined, impressionCountsCacheInMemoryMock);

    await impressionCountsSubmitter();

    expect(postTestImpressionsCountMock.mock.calls).toEqual([
      [JSON.stringify(expectedPayload)],
    ]);
    expect(impressionCountsCacheMock.getImpressionsCount).toHaveBeenCalledTimes(1);
  });

  test('If there is impression counts data in pluggable and memory caches, merge them and POST', async () => {
    impressionCountsCacheMock.getImpressionsCount.mockImplementation(() => Promise.resolve(expectedPayload));
    const impressionCountsCacheInMemoryMock = {
      pop: jest.fn(() => ({
        'f2::3': 6,
        'f1::1': 4,
        'f1::2': 1,
      })),
    };

    // @ts-ignore
    const impressionCountsSubmitter = impressionCountsSubmitterFactory(noopLogger, postTestImpressionsCountMock, impressionCountsCacheMock, undefined, impressionCountsCacheInMemoryMock);

    await impressionCountsSubmitter();

    expect(postTestImpressionsCountMock.mock.calls).toEqual([
      [JSON.stringify({
        pf: [
          { f: 'f1', m: 1, rc: 8 },
          { f: 'f2', m: 2, rc: 8 },
          { f: 'f2', m: 3, rc: 6 },
          { f: 'f1', m: 2, rc: 1 },
        ],
      })],
    ]);
  });

});
