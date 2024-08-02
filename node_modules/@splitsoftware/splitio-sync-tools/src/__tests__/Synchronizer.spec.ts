import { ISynchronizerSettings } from '../../types';

import { Synchronizer } from '../Synchronizer';
import { inMemoryWrapperFactory } from '@splitsoftware/splitio-commons/src/storages/pluggable/inMemoryWrapper';

const inMemoryWrapper = inMemoryWrapperFactory();

describe('Synchronizer creation and execution', () => {

  const config: ISynchronizerSettings = {
    core: {
      authorizationKey: 'th1s_1sF4keAp1k31',
    },
    urls: {
      sdk: 'https://fake.split.io//api',
      events: 'https://fake.events.split.io/api',
      telemetry: 'https://fake.telemetry.split.io/api',
    },
    storage: {
      type: 'PLUGGABLE',
      prefix: 'InMemoryWrapper',
      wrapper: inMemoryWrapper,
    },
  };

  test('Synchronizer execution fails because no Fetch API is present', async () => {
    // Create a synchronizer with a mocked _getFetch function that returns undefined
    const originalGetFetch = Synchronizer._getFetch;
    const _getFetchMock = jest.fn().mockReturnValue(undefined);
    Synchronizer._getFetch = _getFetchMock;
    const synchronizer = new Synchronizer(config);

    let error: any;
    const result = synchronizer.execute((e) => { error = e; });
    // Restore the original _getFetch function synchronously
    Synchronizer._getFetch = originalGetFetch;

    expect(await result).toBe(false);
    expect(error.message).toBe('Global Fetch API is not available');

    expect(_getFetchMock).toBeCalled();
  });

  test('Synchronizer execution fails because APIs check failed', async () => {
    const synchronizer = new Synchronizer(config);
    let error: any;
    expect(await synchronizer.execute((e) => { error = e; })).toBe(false);
    expect(error.message).toBe('Health check of Split API endpoints failed');
  });

  test('Synchronizer execution fails because some synchronization task failed', async () => {
    // Arrange synchronizer to fail on splits and segments synchronization
    const synchronizer = new Synchronizer(config); // @ts-expect-error Private method access
    jest.spyOn(synchronizer, '_checkEndpointHealth').mockImplementation(() => Promise.resolve(true));
    let error: any;
    expect(await synchronizer.execute((e) => { error = e; })).toBe(false);
    expect(error.message).toBe('Feature flags and/or segments synchronization failed');

    // Arrange synchronizer to fail on impressions and events synchronization
    // @ts-expect-error Private method access
    jest.spyOn(synchronizer, 'executeSplitsAndSegments').mockImplementation(() => Promise.resolve(true)); // @ts-ignore
    inMemoryWrapper.pushItems('InMemoryWrapper.SPLITIO.events', ['some_event']); // push an event to make the synchronizer attempt to post it and fail
    expect(await synchronizer.execute((e) => { error = e; })).toBe(false);
    expect(error.message).toBe('Impressions and/or events synchronization failed');
  });

  describe('Pluggable Storage', () => {
    test('Instantiates the Synchronizer and [SUCCESSFULLY] initializes Pluggable Storage', async () => {
      const synchronizer = new Synchronizer(config); // @ts-expect-error Private method access
      await expect(synchronizer.initializeStorage()).resolves.toBe(undefined);
    });

    test('Instantiate the Synchronizer and [FAILS] to initialize Pluggable Storage due to invalid wrapper', async () => { // @ts-ignore
      const synchronizer = new Synchronizer({ ...config, storage: { ...config.storage, wrapper: undefined } }); // @ts-expect-error Private method access
      await expect(synchronizer.initializeStorage()).rejects.toThrowError('Expecting pluggable storage `wrapper` in options, but no valid wrapper instance was provided.');
    });

    test('Instantiate the Synchronizer and [FAILS] to initialize Pluggable Storage due to wrapper connection error', async () => {
      const wrapperWithConnectionError = {
        ...config.storage.wrapper,
        connect: () => { throw new Error('Connection error');},
      };
      const synchronizer = new Synchronizer({ ...config, storage: { ...config.storage, wrapper: wrapperWithConnectionError } });

      // @ts-expect-error Private method access
      jest.spyOn(synchronizer, '_checkEndpointHealth').mockImplementation(() => Promise.resolve(true));
      let error: any;
      await expect(synchronizer.execute((e) => { error = e; })).resolves.toBe(false);
      expect(error.message).toBe('Error when connecting storage. Error: Connection error');
    });

    test('Instantiate the Synchronizer and [FAILS] to release Pluggable Storage due to wrapper disconnection error', async () => {
      const wrapperWithConnectionError = {
        ...config.storage.wrapper,
        disconnect: () => Promise.reject(new Error('Disconnection error')),
      };
      const synchronizer = new Synchronizer({ ...config, storage: { ...config.storage, wrapper: wrapperWithConnectionError } });

      // @ts-expect-error Private method access
      jest.spyOn(synchronizer, '_checkEndpointHealth').mockImplementation(() => Promise.resolve(true));
      let error: any;
      await expect(synchronizer.execute((e) => { error = e; })).resolves.toBe(false);
      expect(error.message).toBe('Error when disconnecting storage. Error: Disconnection error');
    });
  });

  describe('Synchronizer execution mode flow through setting definition', () => {
    const synchronizer = new Synchronizer(config);

    let executeSplitsAndSegmentsCallSpy: jest.SpyInstance;
    let executeImpressionsAndEventsCallSpy: jest.SpyInstance;

    beforeAll(() => { // @ts-expect-error Private method access
      jest.spyOn(synchronizer, 'preExecute').mockImplementation(() => Promise.resolve()); // @ts-expect-error Private method access
      jest.spyOn(synchronizer, 'postExecute').mockImplementation(() => Promise.resolve());
      // @ts-ignore
      executeSplitsAndSegmentsCallSpy = jest.spyOn(synchronizer, 'executeSplitsAndSegments') // @ts-ignore
        .mockImplementation(() => Promise.resolve());
      // @ts-ignore
      executeImpressionsAndEventsCallSpy = jest.spyOn(synchronizer, 'executeImpressionsAndEvents') // @ts-ignore
        .mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('runs [ALL] Synchronizer tasks.', async () => {
      // @ts-ignore
      synchronizer.settings.scheduler.synchronizerMode = 'MODE_RUN_ALL';

      await synchronizer.execute();
      expect(executeSplitsAndSegmentsCallSpy).toBeCalledTimes(1);
      expect(executeImpressionsAndEventsCallSpy).toBeCalledTimes(1);
    });

    test('runs [FEATURE FLAGS & SEGMENTS] Synchronizer tasks only.', async () => {
      // @ts-ignore
      synchronizer.settings.scheduler.synchronizerMode = 'MODE_RUN_FEATURE_FLAGS_AND_SEGMENTS';

      await synchronizer.execute();
      expect(executeSplitsAndSegmentsCallSpy).toBeCalledTimes(1);
      expect(executeImpressionsAndEventsCallSpy).toBeCalledTimes(0);
    });

    test('runs [EVENTS & IMPRESSIONS] Synchronizer tasks only.', async () => {
      // @ts-ignore
      synchronizer.settings.scheduler.synchronizerMode = 'MODE_RUN_EVENTS_AND_IMPRESSIONS';

      await synchronizer.execute();
      expect(executeSplitsAndSegmentsCallSpy).toBeCalledTimes(0);
      expect(executeImpressionsAndEventsCallSpy).toBeCalledTimes(1);
    });
  });

});
