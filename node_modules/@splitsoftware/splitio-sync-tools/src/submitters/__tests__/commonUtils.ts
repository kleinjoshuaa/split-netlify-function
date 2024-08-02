/**
 * Function to create a Random String. Used for mocking `n` field in metadata.
 *
 * @param {number} len  The length of the string to return.
 * @returns {string}
 */
export function _getRandomString(len: number) {
  return (Math.random().toString(36).substring(2, len) + Math.random().toString(36).substring(2, len))
    .substring(0, len);
}

export const noopLogger = {
  debug: () => { },
  info: () => { },
  warn: () => { },
  error: () => { },
  setLogLevel: () => { },
};
