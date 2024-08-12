import { getStore } from "@netlify/blobs";



export function SplitStorageWrapper(storeId, debug=false) {
  let storeName = "splitio";
  if (storeId) {
    storeName +=  `.${storeId}`;
  } 
  const split = getStore({name: storeName,
    siteID: process.env.SITE_ID,
    token: process.env.TOKEN,
});

  return {
    async get(key) {
      if(debug) console.log('getting key', key);
      let ret = (await split.get(key))
      if(debug) console.log('value: '+ret)
      return ret ? ret : null; 
    },
    async set(key, value) {
      if(debug) console.log('setting key', key, 'value', value);
      return (await split.set(key, value));
    },
    async getAndSet(key, value) {
      if(debug) console.log('getting and setting key', key, 'value', value);
      return split
        .get(key)
        ?.then((val) => split.set(key, value).then(() => val)) ?? null;
    },
    async del(key) {
      if(debug) console.log
      return (await split.delete(key));
    },
    async getKeysByPrefix(prefix) {
      if(debug) console.log('getting keys by prefix', prefix);
      const blobs = (await split.list())?.blobs ?? [];

      if (blobs.length === 0) {
        return blobs;
      }
    
      return blobs
        .filter(blob => blob.key.startsWith(prefix))
        .map(blob => blob.key);
    },
    async getMany(keys) {
      if(debug) console.log('getting many keys', keys);
      return (
        await keys.map(async (key) => await split.get(key))
      );
    },
    async incr(key, increment = 1) {
      if(debug) console.log("incrementing key", key, "by", increment);
      let val = split.get(key);
      if (!isNaN(parseInt(val, 10))) {
        val += increment;
      } else {
        val = increment;
      }
      return (await split.set(key, val));
    },
    async decr(key, decrement = 1) {
      if(debug) console.log('decrementing key', key, 'by', decrement);
      let val = split.get(key);
      if (!isNaN(parseInt(val, 10))) {
        val -= decrement;
      } else {
        val = decrement;
      }
      return (await split.set(key, val));
    },
    async itemContains(key, item) {
      if(debug) console.log('item contains key', key, 'item', item);
      return (
        await split.get(key)?.then((x) => x.has(item)) ?? false
      );
    },
    async addItems(key, items) {
      if(debug) console.log('adding items to key', key, 'items', items);
      let set;
      let val = await split.get(key);
      if (val instanceof Set) {
        set = val.union(items);
      } else {
        set = new Set([...items]);
      }
      return (await split.set(key, set));
    },
    async removeItems(key, items) {
      if(debug) console.log('removing items from key', key, 'items', items);
      let set = await split.get(key);
      items.forEach((x) => (set.has(x) ? set.delete(x) : ""));
      return (await split.set(key, set));
    },
    async getItems(key) {
      if(debug) console.log('getting items from key', key);
      return (await split.get(key)) ?? [];
    },
    // No-op. No need to connect to blob
    async connect() {
      //  throws if blob isn't there
      if (typeof split == 'undefined') throw new Error("Split object not provided");
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
