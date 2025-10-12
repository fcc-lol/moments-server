// Helper function to fetch weather data
export async function fetchWeatherData(lat, lng, dateTime) {
  try {
    const date = new Date(dateTime);
    const dateStr = date.toISOString().split("T")[0];

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.hourly?.time?.length > 0) {
      const photoTime = date.getTime();
      let closestIndex = 0;
      let closestDiff = Math.abs(
        new Date(data.hourly.time[0]).getTime() - photoTime
      );

      for (let i = 1; i < data.hourly.time.length; i++) {
        const diff = Math.abs(
          new Date(data.hourly.time[i]).getTime() - photoTime
        );
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      const temperature = data.hourly.temperature_2m[closestIndex];
      const weatherCode = data.hourly.weather_code[closestIndex];

      const weatherDescriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
      };

      return {
        temperature: Math.round(temperature),
        description: weatherDescriptions[weatherCode] || "Unknown conditions"
      };
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch weather data:", error);
    return null;
  }
}
