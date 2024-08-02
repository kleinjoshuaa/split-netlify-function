//const { Synchronizer } = require('@splitsoftware/splitio-sync-tools');
import { Synchronizer } from "@splitsoftware/splitio-sync-tools";
//const {PluggableStorage, ErrorLogger} from "@splitsoftware/splitio-browserjs"
//const { Wrapper } = require("./SplitWrapper")
//import Wrapper from "./SplitWrapper"
import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js"
import { connectLambda } from "@netlify/blobs";

const synchronizer = new Synchronizer({
  core: {
    authorizationKey: process.env.SPLIT_API_KEY,
  },
  storage: {
    // Wrapper object must implement the interface used by the Synchronizer to read and write data into an storage
    type: "PLUGGABLE",
    wrapper: SplitStorageWrapper(process.env.SPLIT_API_KEY),
  },
  debug: true,
});

export async function handler(req, context) {
  connectLambda(req)
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

