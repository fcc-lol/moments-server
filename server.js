import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = 3107;

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from localhost (any port) and moments.fcc.lol
    const allowedOrigins = [
      /^http:\/\/localhost(:\d+)?$/,
      /^https:\/\/localhost(:\d+)?$/,
      "https://moments.fcc.lol",
      "http://moments.fcc.lol"
    ];

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// API Key validation endpoint
app.post("/validate-api-key", (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({
      valid: false,
      message: "API key is required"
    });
  }

  if (apiKey === process.env.FCC_API_KEY) {
    return res.status(200).json({
      valid: true,
      message: "API key is valid"
    });
  }

  return res.status(401).json({
    valid: false,
    message: "Invalid API key"
  });
});

// Geocode location endpoint - gets location name from coordinates
app.post("/geocode-location", async (req, res) => {
  const { apiKey, lat, lng } = req.body;

  // Validate FCC API key
  if (!apiKey || apiKey !== process.env.FCC_API_KEY) {
    return res.status(401).json({
      error: "Invalid API key"
    });
  }

  // Validate coordinates
  if (!lat || !lng || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({
      error: "Invalid coordinates"
    });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) {
    return res.status(500).json({
      error: "Google Maps API key not configured"
    });
  }

  try {
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
        businessName =
          closestPlace.displayName?.text || closestPlace.displayName;
      }
    }

    // Get address components from Geocoding API
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`
    );

    if (!geocodeResponse.ok) {
      return res.status(500).json({
        error: "Failed to fetch geocoding data"
      });
    }

    const geocodeData = await geocodeResponse.json();

    if (geocodeData.status !== "OK" || !geocodeData.results.length) {
      return res.status(404).json({
        error: "No location found"
      });
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

    res.json({
      line1: businessName || street || locality || "Location",
      line2: businessName && street ? street : null,
      line3: cityLine,
      line4: country
    });
  } catch (error) {
    console.error("Error geocoding location:", error);
    res.status(500).json({
      error: "Failed to geocode location"
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
