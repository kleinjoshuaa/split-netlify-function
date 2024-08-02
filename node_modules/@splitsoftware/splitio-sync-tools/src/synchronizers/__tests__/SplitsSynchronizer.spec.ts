// @ts-nocheck
import { SplitsSynchronizer } from '../SplitsSynchronizer';

describe('Splits Synchronizer', () => {
  const _splitFetcherMock = jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: Promise.resolve,
  }));
  const _settingsMock = { log: { error: () => {} } };

  const _splitsInMemoryCacheFactory = () => {
    const _splitsCache = [];
    let _changeNumber;

    return {
      addSplits: jest.fn((splitList: [string, string][]) => {
        splitList.forEach((keyValueTuple) => {
          _splitsCache.push(keyValueTuple[1]);
        });
      }),
      getSplitNames: jest.fn(() => _splitsCache.map(s => JSON.parse(s).name)),
      getSplit: jest.fn((name) => {
        const res = _splitsCache.find(i => i[0] === name);
        return res ? res[1] : null;
      }),
      setChangeNumber: jest.fn((number) => _changeNumber = number),
      getChangeNumber: jest.fn(() => _changeNumber),
      getAll: jest.fn(() => _splitsCache),
      removeSplits: jest.fn((names) => {
        for (let i = 0; i < names.length; i++) {
          const index = _splitsCache.indexOf(names[i]);
          if (index) _splitsCache.splice(index, 1);
        }
      }),
    };
  };

  const _segmentsInMemoryCacheFactory = () => {
    let _segmentsCache = [];

    return {
      registerSegments: jest.fn((segments) => segments.map(s => _segmentsCache.push(s))),
      getRegisteredSegments: jest.fn(() => _segmentsCache),
    };
  };

  const _splitStorageMock = (() => {
    const _splitsStored = [
      JSON.stringify({ name: 'pepito1', changeNumber: 0 }),
      JSON.stringify({ name: 'pepito2', changeNumber: 0 }),
    ];
    let _changeNumber = 1;

    return {
      addSplits: jest.fn((tupleList: [string, string][]) => tupleList.map(tuple => _splitsStored.push(tuple[1]))),
      getSplitNames: jest.fn(() => Promise.resolve(_splitsStored.map(s => JSON.parse(s).name))),
      getAll: jest.fn(() => _splitsStored),
      getSplit: jest.fn((name) => Promise.resolve(_splitsStored[name])),
      setChangeNumber: jest.fn((n) => _changeNumber = n),
      getChangeNumber: jest.fn(() => _changeNumber),
      removeSplits: jest.fn(() => Promise.resolve),
    };
  })();

  const _segmentsStorageMock = (() => {
    let _registeredSegments = ['aSegment'];
    return {
      registerSegments: jest.fn((segments) => {
        segments.map(s => _registeredSegments.push(s));
        _registeredSegments =  Array.from(new Set(_registeredSegments));
      }),
      getRegisteredSegments: jest.fn(() => _registeredSegments),
    };
  })();

  const _inMemoryStorageMockFactory = () => {
    return {
      splits: _splitsInMemoryCacheFactory(),
      segments: _segmentsInMemoryCacheFactory(),
    };
  };

  let _splitsSynchronizer;

  const createNewSynchronizer = () => {
    _splitsSynchronizer = new SplitsSynchronizer(
      _splitFetcherMock,
      _settingsMock,
      _splitStorageMock,
      _segmentsStorageMock,
      _inMemoryStorageMockFactory(),
      _inMemoryStorageMockFactory()
    );
  };

  describe('Synchronize Splits using [InMemoryOperation] mode', () => {
    describe('Get data from Storage.', () => {
      beforeAll(async () => {
        createNewSynchronizer();
        await _splitsSynchronizer.getDataFromStorage();
      });

      test('retrieves [SPLITS] stored from Storage into InMemory cache', () => {
        const splitsNames = _splitsSynchronizer._inMemoryStorage.splits
          .getAll()
          .map((split) => JSON.parse(split).name);

        expect(splitsNames).toEqual(['pepito1', 'pepito2']);
        expect(_splitsSynchronizer._inMemoryStorage.splits.getChangeNumber()).toBe(1);
      });

      test('retrieves [SEGMENTS] stored from Storage into InMemory cache', () => {
        expect(_splitsSynchronizer._inMemoryStorage.segments.getRegisteredSegments()).toEqual(['aSegment']);
      });
    });

    describe('Process Differeces between data previous to Sync and new data.', () => {
      beforeAll(() => {
        createNewSynchronizer();
        _splitsSynchronizer._inMemoryStorageSnapshot.splits.addSplits([
          ['pepito1', '{"name":"pepito1","changeNumber":4}'],
        ]);
        _splitsSynchronizer._inMemoryStorageSnapshot.splits.addSplits([
          ['pepito2', '{"name":"pepito2","changeNumber":4}'],
        ]);
        _splitsSynchronizer._inMemoryStorage.splits.addSplits([
          ['pepito2', '{"name":"pepito2","changeNumber":5}'],
        ]);
        _splitsSynchronizer._inMemoryStorage.splits.addSplits([
          ['pepito3', '{"name":"pepito3","changeNumber":3}'],
        ]);
      });

      test('compares the updated InMemory cache with previous snapshot and removes [1] unusued split', async () => {
        const result = await _splitsSynchronizer.processDifferences();

        expect(result).toBe(1);
      });
    });

    describe('Put data from InMemory Cache to storage - After synchronization occured', () => {
      beforeAll(async () => {
        createNewSynchronizer();
        // adding some data simulating synchronization execution')
        _splitsSynchronizer._inMemoryStorage.splits.addSplits([
          ['pepito3', JSON.stringify({ name: 'pepito3', changeNumber: 6 })],
        ]);

        _splitsSynchronizer._inMemoryStorage.splits.setChangeNumber(12);
        _splitsSynchronizer._inMemoryStorage.segments.registerSegments(['anotherSegment']);

        await _splitsSynchronizer.putDataToStorage();
      });

      test('has stored [SPLITS] data from InMemory cache to Storage.', async () => {
        expect(await _splitStorageMock.getSplitNames()).toStrictEqual(['pepito1', 'pepito2', 'pepito3']);
        expect(await _splitStorageMock.getChangeNumber()).toBe(12);
      });

      test('has stored [SEGMENTS] data from InMemory cache to Storage', async () => {
        expect(await _segmentsStorageMock.getRegisteredSegments()).toEqual(['aSegment', 'anotherSegment']);
      });
    });
  });
});
