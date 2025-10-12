// Helper function to format date/time in a specific timezone
export function formatDateInTimezone(date, timeZoneId) {
  if (!date || !timeZoneId) return null;

  const dateObj = new Date(date);

  // Format the full date and time in the local timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(dateObj);
  const partsObj = {};
  parts.forEach((part) => {
    partsObj[part.type] = part.value;
  });

  // Return ISO-like format in local timezone (without Z suffix or milliseconds)
  return `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;
}
