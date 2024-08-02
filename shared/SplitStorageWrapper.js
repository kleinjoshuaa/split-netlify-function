import { getStore } from "@netlify/blobs";



export function SplitStorageWrapper(storeId) {
  console.log('name: "splitio" + "." + storeId', "splitio" + "." + storeId);
  console.log('process.env.SITE_ID', process.env.SITE_ID);
  console.log('process.env.TOKEN', process.env.TOKEN);
  if (storeId) {
    const split = getStore({name: "splitio" + "." + storeId,
                            siteId: process.env.SITE_ID,
                            token: process.env.TOKEN,
    });
  } else {
    const split = getStore("splitio");
  }
  return {
    async get(key) {
      return (await split.get(key, { type: "strong" })).json();
    },
    async set(key, value) {
      return (await split.set(key, value)).ok;
    },
    async getAndSet(key, value) {
      return split
        .get(key, { type: "strong" })
        .then((val) => split.set(key, value).then(() => val))
        .json();
    },
    async del(key) {
      return (await split.delete(key)).ok;
    },
    async getKeysByPrefix(prefix) {
      return (
        await split
          .list()
          .filter((x) => x.key.startsWith(prefix))
          .map((x) => x.key)
      ).json();
    },
    async getMany(keys) {
      return (
        await keys.map(async (key) => await split.get(key, { type: "strong" }))
      ).json();
    },
    async incr(key, increment = 1) {
      let val = split.get(key, { type: "strong" });
      if (!isNaN(parseInt(val, 10))) {
        val += increment;
      } else {
        val = increment;
      }
      return (await split.set(key, val)).json();
    },
    async decr(key, decrement = 1) {
      let val = split.get(key, { type: "strong" });
      if (!isNaN(parseInt(val, 10))) {
        val -= decrement;
      } else {
        val = decrement;
      }
      return (await split.set(key, val)).json();
    },
    async itemContains(key, item) {
      return (
        await split.get(key, { type: "strong" }).then((x) => x.has(item))
      ).json();
    },
    async addItems(key, items) {
      let val = await split.get(key, { type: "strong" });
      if (val instanceof Set) {
        let set = val.union(items);
      } else {
        let set = new Set([...val]);
      }
      return (await split.set(key, set)).ok;
    },
    async removeItems(key, items) {
      let set = await split.get(key, { type: "strong" });
      items.forEach((x) => (set.has(x) ? set.delete(x) : ""));
      return (await split.set(key, set)).ok;
    },
    async getItems(key) {
      return (await split.get(key, { type: "strong" })).json();
    },
    // No-op. No need to connect to blob
    async connect() {
      //  throws if blob isn't there
      if (!split) throw new Error("Split object not provided");
    },

    // No-op. No need to disconnect from DurableObject stub
    async disconnect() {},

    /** Queue operations */
    // Since Split SDK must run in partial consumer mode, events and impressions are
    // not tracked and so there is no need to implement Queue operations

    async pushItems(key, items) {},

    async popItems(key, count) {
      return [];
    },

    async getItemsCount(key) {
      return 0;
    },
  };
}
