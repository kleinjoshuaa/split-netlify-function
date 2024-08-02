import { ILogger } from '@splitsoftware/splitio-commons/src/logger/types';
import { TelemetryUsageStats } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { ITelemetryCacheAsync } from '@splitsoftware/splitio-commons/src/storages/types';
import { metadataToHeaders } from './utils';
import { ISplitApi } from '@splitsoftware/splitio-commons/src/services/types';
import { _Map, IMap } from '@splitsoftware/splitio-commons/src/utils/lang/maps';


/**
 * Function factory that returns a Telemetry Submitter, a function that retrieves configs and usage stats
 * (latencies and exceptions) from the telemetry storage, and submits them to the Split cloud.
 * The function returns a promise that never rejects, and resolves to true or false if the operation success or not.
 *
 * @param {ILogger}              logger          The Synchronizer's Logger.
 * @param {ISplitApi}            splitApi        The Split's HTTPClient API to perform the POST request.
 * @param {ITelemetryCacheAsync} telemetryCache  The Telemetry storage Cache from where to retrieve data.
 * @returns {() => Promise<boolean>}
 */
export function telemetrySubmitterFactory(
  logger: ILogger,
  splitApi: ISplitApi,
  telemetryCache: ITelemetryCacheAsync,
): () => Promise<boolean> {

  async function buildUsageStats(): Promise<IMap<string, TelemetryUsageStats>> {
    const latencies = await telemetryCache.popLatencies();
    const exceptions = await telemetryCache.popExceptions();

    const result = new _Map<string, TelemetryUsageStats>();

    latencies.forEach((latency, metadata) => {
      result.set(metadata, { mL: latency });
    });

    exceptions.forEach((exception, metadata) => {
      const usageStats = result.get(metadata);
      if (usageStats) {
        usageStats.mE = exception;
      } else {
        result.set(metadata, { mE: exception });
      }
    });

    return result;
  }

  async function synchronizeUsageStats() {
    let usageStats;
    try {
      usageStats = await buildUsageStats();
    } catch (e) {
      logger.error(`An error occurred when retrieving telemetry usage stats from storage: ${e}`);
      return false;
    }

    try {
      // Submit usage stats
      const requests: Promise<any>[] = [];
      usageStats.forEach((usage, metadata) => {
        // No retries for telemetry
        requests.push(splitApi.postMetricsUsage(JSON.stringify(usage), metadataToHeaders(JSON.parse(metadata))));
      });
      await Promise.all(requests);
      return true;
    } catch (e) {
      logger.error(`An error occurred when submitting telemetry usage stats: ${e}`);
      return false;
    }
  }

  async function synchronizeConfigs() {
    let configs;
    try {
      configs = await telemetryCache.popConfigs();
    } catch (e) {
      logger.error(`An error occurred when retrieving telemetry configs from storage: ${e}`);
      return false;
    }

    try {
      // Submit configs
      const requests: Promise<any>[] = [];
      configs.forEach((config, metadata) => {
        // No retries for telemetry
        requests.push(splitApi.postMetricsConfig(JSON.stringify(config), metadataToHeaders(JSON.parse(metadata))));
      });
      await Promise.all(requests);
      return true;
    } catch (e) {
      logger.error(`An error occurred when submitting telemetry configs: ${e}`);
      return false;
    }
  }

  return function () {
    return synchronizeUsageStats().then((usageStatsSuccess) => {
      return synchronizeConfigs().then((configsSuccess) => {
        return usageStatsSuccess && configsSuccess;
      });
    });
  };
}
