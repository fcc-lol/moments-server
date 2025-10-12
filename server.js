import express from "express";
import cors from "cors";
import "dotenv/config";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import sharp from "sharp";
import { geocodeLocation } from "./utils/geocode.js";
import { findMomentByHash } from "./utils/moments.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

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

// Save moment endpoint - saves image and metadata to filesystem
app.post("/save-moment", upload.single("image"), async (req, res) => {
  const { apiKey } = req.body;

  // Validate FCC API key
  if (!apiKey || apiKey !== process.env.FCC_API_KEY) {
    return res.status(401).json({
      error: "Invalid API key"
    });
  }

  // Validate image file
  if (!req.file) {
    return res.status(400).json({
      error: "No image file provided"
    });
  }

  try {
    // Calculate file hash for duplicate detection
    const calculatedHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    // Create moments directory if it doesn't exist
    const momentsDir = path.join(__dirname, "moments");
    if (!fs.existsSync(momentsDir)) {
      fs.mkdirSync(momentsDir, { recursive: true });
    }

    // Check for duplicate based on file hash
    const existingMomentId = findMomentByHash(momentsDir, calculatedHash);
    if (existingMomentId) {
      // Verify that the moment directory and files actually exist
      const existingMomentDir = path.join(momentsDir, existingMomentId);
      const existingMetadataPath = path.join(
        existingMomentDir,
        "metadata.json"
      );
      const existingDirExists = fs.existsSync(existingMomentDir);
      const existingMetadataExists = fs.existsSync(existingMetadataPath);

      // Check if image file exists
      let existingImageExists = false;
      if (existingDirExists) {
        const files = fs.readdirSync(existingMomentDir);
        existingImageExists = files.some((file) => file.startsWith("image."));
      }

      // Only treat as duplicate if all files exist
      if (existingDirExists && existingMetadataExists && existingImageExists) {
        // Read existing metadata to get location data
        let existingLocationData = null;
        try {
          const existingMetadata = JSON.parse(
            fs.readFileSync(existingMetadataPath, "utf8")
          );
          existingLocationData = existingMetadata.locationData || null;
        } catch (e) {
          console.warn("Failed to read existing metadata:", e);
        }

        return res.status(200).json({
          duplicate: true,
          momentId: existingMomentId,
          locationData: existingLocationData,
          message: "Moment already exists"
        });
      }
    }

    // Geocode location if coordinates are provided
    let locationData = null;
    if (req.body.lat && req.body.lng) {
      try {
        const lat = parseFloat(req.body.lat);
        const lng = parseFloat(req.body.lng);

        if (!isNaN(lat) && !isNaN(lng)) {
          locationData = await geocodeLocation(lat, lng);
        }
      } catch (error) {
        console.warn("Failed to geocode location:", error.message);
        // Continue without location data rather than failing
      }
    }

    // Generate unique ID (12 characters, URL-safe)
    const momentId = nanoid(12);

    // Create directory for this moment
    const momentDir = path.join(momentsDir, momentId);
    fs.mkdirSync(momentDir, { recursive: true });

    // Compress and save image file
    const imagePath = path.join(momentDir, "image.jpeg");
    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(2400, 2400, {
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toFile(imagePath);

    // Get compressed image stats
    const compressedStats = fs.statSync(imagePath);

    // Parse and save metadata
    const metadata = {
      id: momentId,
      timestamp: new Date().toISOString(),
      filename: req.file.originalname,
      mimeType: "image/jpeg", // Always JPEG after compression
      originalSize: req.file.size,
      size: compressedStats.size,
      fileHash: calculatedHash
    };

    // Add optional metadata fields if provided
    if (req.body.exifData) {
      try {
        metadata.exifData = JSON.parse(req.body.exifData);
      } catch (e) {
        console.warn("Failed to parse exifData:", e);
      }
    }

    // Add geocoded location data if available
    if (locationData) {
      metadata.locationData = locationData;
    }

    if (req.body.weatherData) {
      try {
        metadata.weatherData = JSON.parse(req.body.weatherData);
      } catch (e) {
        console.warn("Failed to parse weatherData:", e);
      }
    }

    if (req.body.dominantColor) {
      metadata.dominantColor = req.body.dominantColor;
    }

    if (req.body.textColor) {
      metadata.textColor = req.body.textColor;
    }

    // Save metadata to JSON file
    const metadataPath = path.join(momentDir, "metadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      success: true,
      momentId,
      locationData,
      message: "Moment saved successfully"
    });
  } catch (error) {
    console.error("Error saving moment:", error);
    res.status(500).json({
      error: "Failed to save moment",
      details: error.message
    });
  }
});

// Get all moment IDs endpoint - returns array of IDs (no API key required)
app.get("/moments", (req, res) => {
  const momentsDir = path.join(__dirname, "moments");

  // Check if moments directory exists
  if (!fs.existsSync(momentsDir)) {
    return res.json({ momentIds: [] });
  }

  try {
    // Read all directories in moments folder
    const entries = fs.readdirSync(momentsDir, { withFileTypes: true });

    // Filter for valid moment directories (must have metadata.json)
    const momentIds = entries
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        const metadataPath = path.join(momentsDir, entry.name, "metadata.json");
        return fs.existsSync(metadataPath);
      })
      .map((entry) => entry.name);

    res.json(momentIds);
  } catch (error) {
    console.error("Error reading moments:", error);
    res.status(500).json({ error: "Error reading moments" });
  }
});

// Get moment by ID endpoint - returns JSON (no API key required)
app.get("/moments/:momentId", (req, res) => {
  const { momentId } = req.params;

  const momentDir = path.join(__dirname, "moments", momentId);
  const metadataPath = path.join(momentDir, "metadata.json");

  // Check if moment exists
  if (!fs.existsSync(metadataPath)) {
    return res.status(404).json({ error: "Moment not found" });
  }

  try {
    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    // Verify image file exists
    const files = fs.readdirSync(momentDir);
    const imageFile = files.find((file) => file.startsWith("image."));

    if (!imageFile) {
      return res.status(404).json({ error: "Moment image not found" });
    }

    // Return metadata with image URL
    res.json({
      ...metadata,
      imageUrl: `/moments/${momentId}/image`
    });
  } catch (error) {
    console.error("Error loading moment:", error);
    res.status(500).json({ error: "Error loading moment" });
  }
});

// Get moment image endpoint - serves raw image file (no API key required)
app.get("/moments/:momentId/image", (req, res) => {
  const { momentId } = req.params;

  const momentDir = path.join(__dirname, "moments", momentId);

  // Check if moment directory exists
  if (!fs.existsSync(momentDir)) {
    return res.status(404).json({ error: "Moment not found" });
  }

  try {
    // Find the image file
    const files = fs.readdirSync(momentDir);
    const imageFile = files.find((file) => file.startsWith("image."));

    if (!imageFile) {
      return res.status(404).json({ error: "Image not found" });
    }

    const imagePath = path.join(momentDir, imageFile);

    // Send the file with proper caching headers
    res.sendFile(imagePath, {
      maxAge: 31536000000, // 1 year cache
      immutable: true
    });
  } catch (error) {
    console.error("Error loading image:", error);
    res.status(500).json({ error: "Error loading image" });
  }
});

// Helper function to escape HTML special characters
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Share preview endpoint - generates HTML with Open Graph tags for social media crawlers
app.get("/share-preview/:momentId", (req, res) => {
  const { momentId } = req.params;

  const momentDir = path.join(__dirname, "moments", momentId);
  const metadataPath = path.join(momentDir, "metadata.json");

  // Check if moment exists
  if (!fs.existsSync(metadataPath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Moment Not Found</title>
          <meta property="og:title" content="Moment Not Found" />
          <meta property="og:description" content="This moment could not be found." />
        </head>
        <body>
          <h1>Moment Not Found</h1>
        </body>
      </html>
    `);
  }

  try {
    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    // Verify image file exists
    const files = fs.readdirSync(momentDir);
    const imageFile = files.find((file) => file.startsWith("image."));

    if (!imageFile) {
      return res.status(404).send("Image not found");
    }

    // Build title and description
    const titleParts = [];
    const descriptionParts = [];

    // Add location to title
    if (metadata.locationData?.line1) {
      titleParts.push(metadata.locationData.line1);
    }

    // Add date to title
    if (metadata.exifData?.DateTimeOriginal) {
      const date = new Date(metadata.exifData.DateTimeOriginal);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      titleParts.push(dateStr);
    }

    const title = titleParts.length > 0 ? titleParts.join(" · ") : "Moment";

    // Build description with address and weather only
    if (metadata.locationData) {
      const addressParts = [
        metadata.locationData.line1,
        metadata.locationData.line2,
        metadata.locationData.line3,
        metadata.locationData.line4
      ]
        .filter(Boolean)
        .join(", ");
      if (addressParts) descriptionParts.push(addressParts);
    }

    if (metadata.weatherData) {
      const weatherParts = [];
      if (metadata.weatherData.description) {
        weatherParts.push(metadata.weatherData.description);
      }
      if (metadata.weatherData.temperature !== undefined) {
        weatherParts.push(`${Math.round(metadata.weatherData.temperature)}°`);
      }
      if (weatherParts.length > 0) {
        descriptionParts.push(weatherParts.join(", "));
      }
    }

    const description =
      descriptionParts.length > 0
        ? descriptionParts.join(" · ")
        : "A moment in time";

    const imageUrl = `https://moments-server.fcc.lol/moments/${momentId}/image`;
    const pageUrl = `https://moments.fcc.lol/${momentId}`;

    // Escape HTML to prevent XSS
    const escapedTitle = escapeHtml(title);
    const escapedDescription = escapeHtml(description);

    // Generate HTML with Open Graph meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="2400" />
    <meta property="og:image:height" content="2400" />
    <meta property="og:image:type" content="image/jpeg" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${pageUrl}" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:image" content="${imageUrl}" />
    
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #111;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .container {
        max-width: 600px;
        text-align: center;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
      }
      h1 {
        margin-top: 20px;
      }
      p {
        color: #888;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <img src="${imageUrl}" alt="${escapedTitle}" />
      <h1>${escapedTitle}</h1>
      <p>${escapedDescription}</p>
      <p><a href="${pageUrl}" style="color: #fff;">View moment →</a></p>
    </div>
  </body>
</html>`;

    res.set("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating share preview:", error);
    res.status(500).send("Error generating preview");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
