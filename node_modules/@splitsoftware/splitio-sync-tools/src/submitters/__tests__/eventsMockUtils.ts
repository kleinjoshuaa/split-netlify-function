import { StoredEventWithMetadata } from '@splitsoftware/splitio-commons/src/sync/submitters/types';
import { _getRandomString } from './commonUtils';

/**
 * Mock representing an Event String with no Properties object.
 *
 * @type {string}
 */
export const singleEventMockNoProperties = `{
  "m":{
    "s":"go-6.1.0",
    "i":"192.168.0.6",
    "n":"ip-192-168-0-6"
  },
  "e": {
    "key":"joe",
    "trafficTypeName":
    "user","eventTypeId":
    "event",
    "value":5,
    "timestamp":1621273519949
  }
}`;
/**
 * Function to return a single Mock Event, with the option to randomise some of its data.
 *
 * @param {boolean} isSetMaxSize  Flag to decide to randomise some of the Metadata.
 * @param {boolean} randomise     Flag to decide to randomise some of the Metadata.
 * @returns {string}
 */
export function getSingleEventString(isSetMaxSize = false, randomise = false): string {
  const _newEvent = JSON.parse(singleEventMockNoProperties);
  // Randomise metadata.name parameter.
  if (randomise) {
    _newEvent.m.n = _getRandomString(14);
  }
  // Add Properties object with a string value to reach 1024 bytes size for event limit.
  if (isSetMaxSize) {
    _newEvent.properties = Object.assign({}, { a: Array(841).join('X') });
  }

  return JSON.stringify(_newEvent);
}
/**
 * Function to return a list with a specific number of Events with the same metadata, with the option of generating
 * the events set with Max Size per event cap, or randomize metadata.
 *
 * @param {number}  amount        The amount of events to add and return in the list.
 * @param {boolean} isSetMaxSize  The flag to define if the events are set to its Max Size.
 * @param {boolean} randomise     The flag to set the same random metadata for the events in the list.
 * @returns {StoredEventWithMetadata[]}
 */
export function getMultipleEventsSameMetadata(
  amount: number,
  isSetMaxSize: boolean = false,
  randomise: boolean = false
): StoredEventWithMetadata[] {
  const _singleEvent = getSingleEventString(isSetMaxSize, randomise);
  const _eventsList = [];

  for (let i = 0; i < amount; i++) {
    _eventsList.push(JSON.parse(_singleEvent));
  }

  return _eventsList;
}
