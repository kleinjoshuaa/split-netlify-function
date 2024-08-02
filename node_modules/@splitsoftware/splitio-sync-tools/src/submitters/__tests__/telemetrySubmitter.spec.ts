import { MultiMethodLatencies } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { MultiConfigs, MultiMethodExceptions } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { telemetrySubmitterFactory } from '../telemetrySubmitter';
import { metadataToHeaders } from '../utils';

describe('Telemetry Submitter', () => {
  const splitApiMock = {
    postMetricsConfig: jest.fn(() => Promise.resolve()),
    postMetricsUsage: jest.fn(() => Promise.resolve()),
  };
  const telemetryCacheMock = {
    popLatencies: jest.fn(),
    popExceptions: jest.fn(),
    popConfigs: jest.fn(),
  };
  const loggerMock = {
    error: jest.fn(),
  };

  // @ts-ignore
  const telemetrySubmitter = telemetrySubmitterFactory(loggerMock, splitApiMock, telemetryCacheMock);

  beforeEach(() => {
    loggerMock.error.mockClear();
    splitApiMock.postMetricsConfig.mockClear();
    splitApiMock.postMetricsUsage.mockClear();
    telemetryCacheMock.popLatencies.mockClear();
    telemetryCacheMock.popExceptions.mockClear();
    telemetryCacheMock.popConfigs.mockClear();
  });

  test('If there is no telemetry data, do nothing', async () => {
    telemetryCacheMock.popLatencies = jest.fn(() => Promise.resolve(new Map()));
    telemetryCacheMock.popExceptions = jest.fn(() => Promise.resolve(new Map()));
    telemetryCacheMock.popConfigs = jest.fn(() => Promise.resolve(new Map()));

    await telemetrySubmitter();

    expect(telemetryCacheMock.popLatencies).toHaveBeenCalledTimes(1);
    expect(telemetryCacheMock.popExceptions).toHaveBeenCalledTimes(1);
    expect(telemetryCacheMock.popConfigs).toHaveBeenCalledTimes(1);
    expect(splitApiMock.postMetricsConfig).not.toHaveBeenCalled();
    expect(splitApiMock.postMetricsUsage).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  test('If there is telemetry data, POST it', async () => {
    const metadata1 = { s: '1', n: 'n', i: 'i' };
    const metadata2 = { s: '2', n: 'n', i: 'i' };
    const metadata3 = { s: '3', n: 'n', i: 'i' };

    // @ts-ignore
    telemetryCacheMock.popLatencies = jest.fn(() => Promise.resolve<MultiMethodLatencies>(new Map([
      [JSON.stringify(metadata1), { t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }],
      [JSON.stringify(metadata2), { tr: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] }],
    ]))); // @ts-ignore
    telemetryCacheMock.popExceptions = jest.fn(() => Promise.resolve<MultiMethodExceptions>(new Map([
      [JSON.stringify(metadata1), { t: 1 }],
      [JSON.stringify(metadata3), { tr: 2 }],
    ])));
    telemetryCacheMock.popConfigs = jest.fn(() => Promise.resolve<MultiConfigs>(new Map([
      [JSON.stringify(metadata1), { oM: 1, st: 'pluggable', aF: 0, rF: 0 }],
      [JSON.stringify(metadata2), { oM: 1, st: 'redis', aF: 0, rF: 0 }],
    ])));

    await telemetrySubmitter();

    expect(telemetryCacheMock.popLatencies).toHaveBeenCalledTimes(1);
    expect(telemetryCacheMock.popExceptions).toHaveBeenCalledTimes(1);
    expect(telemetryCacheMock.popConfigs).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).not.toHaveBeenCalled();

    expect(splitApiMock.postMetricsConfig.mock.calls).toEqual([
      [JSON.stringify({ oM: 1, st: 'pluggable', aF: 0, rF: 0 }), metadataToHeaders(metadata1)],
      [JSON.stringify({ oM: 1, st: 'redis', aF: 0, rF: 0 }), metadataToHeaders(metadata2)],
    ]);
    expect(splitApiMock.postMetricsUsage.mock.calls).toEqual([
      [JSON.stringify({ mL: { t: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }, mE: { t: 1 } }), metadataToHeaders(metadata1)],
      [JSON.stringify({ mL: { tr: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] } }), metadataToHeaders(metadata2)],
      [JSON.stringify({ mE: { tr: 2 } }), metadataToHeaders(metadata3)],
    ]);
  });

});
