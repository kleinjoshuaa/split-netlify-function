import { Synchronizer } from "@splitsoftware/splitio-sync-tools";

import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js"
import { connectLambda } from "@netlify/blobs";



export async function handler(req, context) {

  connectLambda(req)
  
  
  const synchronizer = new Synchronizer({
    core: {
      authorizationKey: process.env.SPLIT_API_KEY,
    },
    storage: {
      // Wrapper object must implement the interface used by the Synchronizer to read and write data into an storage
      type: "PLUGGABLE",
      wrapper: SplitStorageWrapper(process.env.SPLIT_API_KEY, true),
    },
    sync: {
      splitFilters: [{type: "bySet", values: ["mobile"]}],
    },
    debug: true,
  });

  try {
    await new Promise((res, rej) => {
      synchronizer.execute((error) => (error ? rej(error) : res()));
    });
    return {
      body: "Synchronization completed successfully",
      statusCode: 200,
    };
  } catch (error) {
    return { 
      body:`Synchronization failed with error: ${error}`,
      statusCode: 500,
    }
    };
  }

