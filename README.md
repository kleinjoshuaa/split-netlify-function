# Netlify Edge Functions with Split.io Integration

This project demonstrates how to use Netlify Edge Functions and blob storage with Split.io for feature flagging and A/B testing. The project includes a sample edge function that serves different HTML pages based on the feature flag evaluation.


## Prerequisites

- Node.js
- Netlify CLI and account
- Split.io account and API key
- Feature flag in Split.io called `my_flag` that evaluates to on or off

## Setup

1. Clone the repository:

    ```sh
    git clone https://github.com/kleinjoshuaa/split-netlify-function
    cd split-netlify-function
    ```

2. Install dependencies:

    ```sh
    npm install
    ```

3. Create  environment variables in netlify add your Split.io API key.

    ```env
    SPLIT_API_KEY=your_split_api_key
    ```

## Running Locally

To run the project locally, use the Netlify CLI:

```sh
netlify dev
```

## Deployment
To deploy the project to Netlify, use the following command:

```sh
netlify deploy
```

## Edge Function
The main edge function is located in [`edge-functions/hello.js`](edge-functions/hello.js). It uses Split.io to evaluate feature flags and serves different HTML pages based on the evaluation result.

## Example Code
```js
// netlify/edge-functions/hello.js
import {
    SplitFactory,
    PluggableStorage,
    ErrorLogger
  } from "@splitsoftware/splitio-browserjs";
import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js"
export const config = {path: "/split"};
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
      wrapper: SplitStorageWrapper(process.env.SPLIT_API_KEY)
    }),
    // Disable or keep only ERROR log level in production, to minimize performance impact
    debug: ErrorLogger()
  });
  const client = factory.client();

  // Await until the SDK is ready or timed out, for which treatment evaluations will be 'control'.
  // Timed out should never happen if SplitStorage durable object binding is properly configured.
  await new Promise(res => {
    client.on(client.Event.SDK_READY, res);
    client.on(client.Event.SDK_READY_TIMED_OUT, res);
  });

  // Async evaluation, because it access the rollout plan from the Split Storage
  const treatment = await client.getTreatment('my_flag');
    let page;
    if (treatment === 'on') {
      page = 'alternative.html';
    } else {
      page = 'index.html';
    }
    const manager = await factory.manager();
    console.log(await client.getTreatments(await manager.names()));
    // Fetch the selected HTML page
    const response = await fetch(new URL(`/${page}`, url.origin));
    const htmlContent = await response.text();
    const endTime = performance.now(); // End timing
    const duration = endTime - startTime; // Calculate duration
    console.log(`Function execution time: ${duration} milliseconds`);
    return new Response(htmlContent, {
      headers: { 'Content-Type': 'text/html' },
    });
  };
  
```

## Split Wrapper Implementation

The project includes a shared utility for Split.io storage wrapper located in [`shared/SplitStorageWrapper.js`](shared/SplitStorageWrapper.js).

This is based upon the wrapper that was implemented for [cloudflare workers](https://github.com/splitio/cloudflare-workers-template/blob/main/src/SplitStorageWrapper.ts), but is instead implemented for netlify blobs. 
