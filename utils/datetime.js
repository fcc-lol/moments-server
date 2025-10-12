// Helper function to format date/time (EXIF DateTimeOriginal is already in local time)
export function formatDateInTimezone(date, timeZoneId) {
  if (!date) return null;

  // EXIF DateTimeOriginal is already in local time where the photo was taken
  // Just remove the .000Z suffix to get: YYYY-MM-DDTHH:mm:ss
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  
  // Remove the Z and milliseconds, keeping format: YYYY-MM-DDTHH:mm:ss
  return dateStr.replace(/\.\d{3}Z$/, '');
}
