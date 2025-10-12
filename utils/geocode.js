// Helper function to geocode coordinates to location data
export const geocodeLocation = async (lat, lng) => {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    throw new Error("Google Maps API key not configured");
  }

  let businessName = null;

  // Try to find a nearby business/POI first
  const placesResponse = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": "places.displayName"
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng
            },
            radius: 50.0
          }
        },
        maxResultCount: 1
      })
    }
  );

  if (placesResponse.ok) {
    const placesData = await placesResponse.json();
    if (placesData.places && placesData.places.length > 0) {
      const closestPlace = placesData.places[0];
      businessName = closestPlace.displayName?.text || closestPlace.displayName;
    }
  }

  // Get address components from Geocoding API
  const geocodeResponse = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`
  );

  if (!geocodeResponse.ok) {
    throw new Error("Failed to fetch geocoding data");
  }

  const geocodeData = await geocodeResponse.json();

  if (geocodeData.status !== "OK" || !geocodeData.results.length) {
    throw new Error("No location found");
  }

  const firstResult = geocodeData.results[0];
  const components = firstResult.address_components;

  // Helper to get component value
  const getComponent = (type) => {
    const component = components.find((c) => c.types.includes(type));
    return component?.long_name || "";
  };

  const getShortComponent = (type) => {
    const component = components.find((c) => c.types.includes(type));
    return component?.short_name || "";
  };

  // Build structured address
  const streetNumber = getComponent("street_number");
  const route = getComponent("route");
  const street = [streetNumber, route].filter(Boolean).join(" ");

  // Try to get locality, with fallbacks
  const locality =
    getComponent("locality") ||
    getComponent("sublocality") ||
    getComponent("neighborhood") ||
    getComponent("postal_town");
  const state = getShortComponent("administrative_area_level_1");
  const postalCode = getComponent("postal_code");

  const cityStateParts = [locality, state].filter(Boolean).join(", ");
  const cityLine = [cityStateParts, postalCode].filter(Boolean).join(" ");

  const country = getComponent("country");

  return {
    line1: businessName || street || locality || "Location",
    line2: businessName && street ? street : null,
    line3: cityLine,
    line4: country
  };
};
