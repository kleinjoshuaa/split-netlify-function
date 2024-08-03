# Netlify Edge Functions with Split.io Integration

This project demonstrates how to use Netlify Edge Functions and blob storage with Split.io for feature flagging and A/B testing. The project includes a sample edge function that serves different HTML pages based on the feature flag evaluation.

## Project Structure
netlify/ ├── .gitignore ├── .netlify/ │ ├── blobs-serve/ │ ├── edge-functions-dist/ │ │ ├── 779f8481dc4fd28f58b4671e2837779d8a73237a541761ec52bbc8891ce60d41.eszip │ │ ├── manifest.json │ ├── edge-functions-import-map.json │ ├── edge-functions-serve/ │ ├── functions/ │ ├── functions-internal/ │ ├── netlify.toml │ ├── state.json │ ├── v1/ ├── .vscode/ │ ├── launch.json ├── edge-functions/ │ ├── hello.js ├── functions/ │ ├── .netlify/ │ ├── scheduled-sync.mjs ├── netlify.toml ├── package.json ├── public/ │ ├── alternative.html │ ├── error.html │ ├── index.html ├── README.md ├── shared/ │ ├── SplitStorageWrapper.js


## Prerequisites

- Node.js
- Netlify CLI and account
- Split.io account and API key
- Feature flag in Split.io called `my_flag` that evaluates to on or off

## Setup

1. Clone the repository:

    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. Install dependencies:

    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory and add your Split.io API key:

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
The main edge function is located in `edge-functions/hello.js`. It uses Split.io to evaluate feature flags and serves different HTML pages based on the evaluation result.

## Example Code
```js
import {
    SplitFactory,
    PluggableStorage,
    ErrorLogger
} from "@splitsoftware/splitio-browserjs";
import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js";

export const config = { path: "/split" };

export default async (request) => {
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
        debug: ErrorLogger()
    });

    const client = factory.client();

    await new Promise(res => {
        client.on(client.Event.SDK_READY, res);
        client.on(client.Event.SDK_READY_TIMED_OUT, res);
    });

    const treatment = await client.getTreatment('my_flag');
    let page;
    if (treatment === 'on') {
        page = 'alternative.html';
    } else {
        page = 'index.html';
    }

    const response = await fetch(new URL(`/${page}`, url.origin));
    const htmlContent = await response.text();

    return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html' },
    });
};
```

## Split Wrapper Implementation

The project includes a shared utility for Split.io storage wrapper located in `shared/SplitStorageWrapper.js`.

This is based upon the wrapper that was implemented for [cloudflare workers](https://github.com/splitio/cloudflare-workers-template/blob/main/src/SplitStorageWrapper.ts), but is instead implemented for netlify blobs. 