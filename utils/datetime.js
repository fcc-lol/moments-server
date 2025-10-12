// Convert EXIF date string to ISO format without timezone conversion
// EXIF format: "2025:07:20 13:03:25" -> ISO format: "2025-07-20T13:03:25.000Z"
export function exifDateToISO(exifDateStr) {
  if (!exifDateStr) return null;

  // If it's already in ISO format, return as-is
  if (typeof exifDateStr === "string" && exifDateStr.includes("T")) {
    return exifDateStr;
  }

  // If it's a Date object, extract components using UTC methods to avoid timezone conversion
  if (exifDateStr instanceof Date) {
    const year = exifDateStr.getUTCFullYear();
    const month = String(exifDateStr.getUTCMonth() + 1).padStart(2, "0");
    const day = String(exifDateStr.getUTCDate()).padStart(2, "0");
    const hour = String(exifDateStr.getUTCHours()).padStart(2, "0");
    const minute = String(exifDateStr.getUTCMinutes()).padStart(2, "0");
    const second = String(exifDateStr.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  }

  // Parse EXIF date format: "YYYY:MM:DD HH:mm:ss"
  const match = exifDateStr.match(
    /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  // Convert to ISO format with .000Z suffix (treating the time as-is, no timezone conversion)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

// Helper function to format date/time (EXIF DateTimeOriginal is already in local time)
export function formatDateInTimezone(date, timeZoneId) {
  if (!date) return null;

  // EXIF DateTimeOriginal is already in local time where the photo was taken
  // Just remove the .000Z suffix to get: YYYY-MM-DDTHH:mm:ss
  const dateStr = typeof date === "string" ? date : date.toISOString();

  // Remove the Z and milliseconds, keeping format: YYYY-MM-DDTHH:mm:ss
  return dateStr.replace(/\.\d{3}Z$/, "");
}
