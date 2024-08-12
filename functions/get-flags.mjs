// netlify/edge-functions/hello.js
import {
    SplitFactory,
    PluggableStorage,
    ErrorLogger
  } from "@splitsoftware/splitio-browserjs";
import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js"
export default async (request) => {
  const startTime = performance.now(); // Start timing
  const url = new URL(request.url);
  const key = url.searchParams.get("user") ?? 'default';

    const factory = SplitFactory({
    core: {
      authorizationKey: process.env.SPLIT_API_KEY,
      key: key
    },
    mode: "consumer_partial",
    storage: PluggableStorage({
      wrapper: SplitStorageWrapper(process.env.SPLIT_API_KEY, true)
    }),
    // Disable or keep only ERROR log level in production, to minimize performance impact
    debug: "INFO"
  });
  const client = factory.client();

  // Await until the SDK is ready or timed out, for which treatment evaluations will be 'control'.
  // Timed out should never happen if SplitStorage durable object binding is properly configured.
  await new Promise(res => {
    client.on(client.Event.SDK_READY, res);
    client.on(client.Event.SDK_READY_TIMED_OUT, res);
  });

  // Async evaluation, because it access the rollout plan from the Split Storage
  const manager = await factory.manager()
  const names = await manager.names()
  const treatments = await client.getTreatments(names);
 
    // Fetch the selected HTML page
    
    return new Response(JSON.stringify(treatments, null, 4));
  };
  