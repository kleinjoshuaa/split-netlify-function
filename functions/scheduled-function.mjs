//const { Synchronizer } = require('@splitsoftware/splitio-sync-tools');
import { Synchronizer } from "@splitsoftware/splitio-sync-tools";
//const {PluggableStorage, ErrorLogger} from "@splitsoftware/splitio-browserjs"
//const { Wrapper } = require("./SplitWrapper")
//import Wrapper from "./SplitWrapper"
import { SplitStorageWrapper } from "../shared/SplitStorageWrapper.js"

const synchronizer = new Synchronizer({
  core: {
    authorizationKey: process.env.SPLIT_API_KEY,
  },
  storage: {
    // Wrapper object must implement the interface used by the Synchronizer to read and write data into an storage
    type: "PLUGGABLE",
    wrapper: SplitStorageWrapper(process.env.SPLIT_API_KEY),
  },
});

export async function handler (event, context) {
  try {
    await new Promise((res, rej) => {
      synchronizer.execute((error) => (error ? rej(error) : res()));
    });
    return new Response("Synchronization finished");
  } catch (error) {
    return new Response(`Synchronization failed with error: ${error}`, {
      status: 500,
    });
  }
};
