import { metadataToHeaders } from '../utils';
import { eventsSubmitterFactory } from '../eventsSubmitter';
import { getMultipleEventsSameMetadata } from './eventsMockUtils';
import { noopLogger } from './commonUtils';

describe('Events Submitter for Lightweight Synchronizer', () => {
  const _postEventsMock = jest.fn(() => Promise.resolve());
  const _eventsCacheMock = {
    popNWithMetadata: jest.fn(),
    count: jest.fn(),
  };

  // @ts-ignore
  const _eventsSubmitter = eventsSubmitterFactory(noopLogger, _postEventsMock, _eventsCacheMock);

  beforeEach(() => {
    _eventsCacheMock.count.mockReturnValue(Promise.resolve(0));
  });

  afterEach(() => {
    _postEventsMock.mockClear();
    _eventsCacheMock.popNWithMetadata.mockClear();
    _eventsCacheMock.count.mockClear();
  });

  test('Pop 3 events from Storage and make an Events POST', async () => {
    const _eventsMock = getMultipleEventsSameMetadata(3);
    const _metadata = metadataToHeaders(_eventsMock[0].m);
    const _eventsList = _eventsMock.map(i => i.e);
    _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve((_eventsMock)));

    const res = await _eventsSubmitter();

    expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(1000);
    expect(_postEventsMock).toBeCalledWith(JSON.stringify(_eventsList), _metadata);
    expect(res).toBe(true);
  });

  test(
    'Pop 5 events from Storage, process and split them by METADATA in 2 calls, then make an Events POST.',
    async () => {
      const _eventsMock1 = getMultipleEventsSameMetadata(3, false, true);
      const _metadata1 = metadataToHeaders(_eventsMock1[0].m);
      const _eventsMock2 = getMultipleEventsSameMetadata(2, false, true);
      const _metadata2 = metadataToHeaders(_eventsMock2[0].m);
      _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve([..._eventsMock1, ..._eventsMock2]));

      const res = await _eventsSubmitter();

      expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(1000);
      expect(_postEventsMock).toHaveBeenNthCalledWith(1, JSON.stringify(_eventsMock1.map(i => i.e)), _metadata1);
      expect(_postEventsMock).toHaveBeenNthCalledWith(2, JSON.stringify(_eventsMock2.map(i => i.e)), _metadata2);
      expect(res).toBe(true);
    }
  );

  test(
    'Pop 6 events from Storage, process and split them by MAX SIZE batches in 2 calls, then make an Events POST.',
    async () => {
      const _eventsMock = getMultipleEventsSameMetadata(10000, true);
      _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve(_eventsMock));

      const res = await _eventsSubmitter();

      expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(1000);
      expect(_postEventsMock).toBeCalledTimes(2);
      expect(res).toBe(true);
    }
  );

  test('Pop 46 events from Storage, process and split them by METADATA and MAX SIZE batches in 10 calls, then make an Events Post.',
    async () => {
      const _eventsMock = [
        ...getMultipleEventsSameMetadata(10000, false, true),
        ...getMultipleEventsSameMetadata(10000, false, true),
        ...getMultipleEventsSameMetadata(10000, true, true),
        ...getMultipleEventsSameMetadata(10000, true, true),
      ];

      _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve(_eventsMock));
      await _eventsSubmitter();

      expect(_postEventsMock).toBeCalledTimes(6);
    });

  test('Abort Sync tasks after all [3] set retries attempts fail', async () => {
    const _failPostEventsMock = jest.fn(() => Promise.reject());
    // @ts-ignore
    const _eventsSubmitterToFail = eventsSubmitterFactory(noopLogger, _failPostEventsMock, _eventsCacheMock);

    const _eventsMock = getMultipleEventsSameMetadata(3);
    const _metadata = metadataToHeaders(_eventsMock[0].m);
    const _eventsList = _eventsMock.map(i => i.e);
    _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve((_eventsMock)));

    const res = await _eventsSubmitterToFail();

    expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(1000);
    expect(_failPostEventsMock).toBeCalledWith(JSON.stringify(_eventsList), _metadata);
    expect(_failPostEventsMock).toBeCalledTimes(3);
    expect(res).toBe(false);
  });

  test('Abort Sync tasks after all [10] set retries attempts fail', async () => {
    const _failPostEventsMock = jest.fn(() => Promise.reject());
    // @ts-ignore
    const _eventsSubmitterToFail = eventsSubmitterFactory(noopLogger, _failPostEventsMock, _eventsCacheMock, undefined, 10);

    const _eventsMock = getMultipleEventsSameMetadata(3);
    const _metadata = metadataToHeaders(_eventsMock[0].m);
    const _eventsList = _eventsMock.map(i => i.e);
    _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve((_eventsMock)));

    const res = await _eventsSubmitterToFail();

    expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(1000);
    expect(_failPostEventsMock).toBeCalledWith(JSON.stringify(_eventsList), _metadata);
    expect(_failPostEventsMock).toBeCalledTimes(10);
    expect(res).toBe(false);
  });

  test('Multiple runs [2] times, until storage count is 0', async () => {
    _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve([]));
    _eventsCacheMock.count
      .mockReturnValueOnce(Promise.resolve(3))
      .mockReturnValue(Promise.resolve(0));

    const res = await _eventsSubmitter();

    expect(_eventsCacheMock.popNWithMetadata).toBeCalledTimes(2);
    expect(res).toBe(true);
  });

  test('Define specific batch size of [30] Events from storage', async () => {
    // @ts-ignore
    const _customEventsSubmitter = eventsSubmitterFactory(noopLogger, _postEventsMock, _eventsCacheMock, 30);
    _eventsCacheMock.popNWithMetadata.mockReturnValue(Promise.resolve([]));

    _eventsCacheMock.count
      .mockReturnValueOnce(Promise.resolve(30))
      .mockReturnValue(Promise.resolve(0));
    const res = await _customEventsSubmitter();

    expect(_eventsCacheMock.popNWithMetadata).toBeCalledWith(30);
    expect(_eventsCacheMock.popNWithMetadata).toBeCalledTimes(2);
    expect(res).toBe(true);
  });
});
