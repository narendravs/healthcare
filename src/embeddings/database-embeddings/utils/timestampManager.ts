// utils/timestampManager.js
import * as fs from "fs";

/**
 * Reads the last checked timestamp from a file.
 * If the file doesn't exist, it returns an ISO string for the Unix epoch (start of time).
 * @param {string} filePath - The path to the timestamp file.
 * @returns {Promise<string>} The last checked timestamp in ISO 8601 format.
 */

export function readTimestamp(filePath: any) {
  try {
    if (fs.existsSync(filePath)) {
      const timestamp = fs.readFileSync(filePath, "utf8").trim();
      // Validate if it's a valid ISO string, otherwise return epoch
      if (new Date(timestamp).toISOString() === timestamp) {
        return timestamp;
      }
    }
  } catch (error) {
    console.error(`Error reading timestamp from ${filePath}:`, error);
  }
  // Default to epoch if file doesn't exist or is invalid
  return new Date(0).toISOString();
}

/**
 * Writes the new last checked timestamp to a file.
 * @param {string} filePath - The path to the timestamp file.
 * @param {string} timestamp - The timestamp to write (ISO 8601 format).
 * @returns {Promise<void>}
 */
export function writeTimestamp(filePath: any, timestamp: any) {
  try {
    fs.writeFileSync(filePath, timestamp, "utf8");
    console.log(`Timestamp saved to ${filePath}: ${timestamp}`);
  } catch (error) {
    console.error(`Error writing timestamp to ${filePath}:`, error);
  }
}
