import sharp from "sharp";

// Helper function to extract dominant color from image
export async function extractDominantColor(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0,
      g = 0,
      b = 0;
    const pixelCount = info.width * info.height;

    for (let i = 0; i < data.length; i += info.channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    const avgColor = [
      Math.round(r / pixelCount),
      Math.round(g / pixelCount),
      Math.round(b / pixelCount)
    ];

    // Helper function to calculate perceived brightness
    const getBrightness = (rgb) => {
      return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    };

    // Apply minimal brightening if needed
    const brightness = getBrightness(avgColor);
    let finalColor = avgColor;

    if (brightness < 120) {
      const factor = 120 / brightness;
      finalColor = avgColor.map((c) => Math.min(255, Math.round(c * factor)));
    } else if (brightness < 160) {
      finalColor = avgColor.map((c) => Math.min(255, c + (255 - c) * 0.3));
    }

    // Create a brighter version for text
    const textBrightness = getBrightness(finalColor);
    let textColorRgb = finalColor;

    if (textBrightness < 200) {
      textColorRgb = finalColor.map((c) => Math.min(255, c + (255 - c) * 0.6));
    }

    return {
      dominantColor: `rgb(${Math.round(finalColor[0])}, ${Math.round(
        finalColor[1]
      )}, ${Math.round(finalColor[2])})`,
      textColor: `rgb(${Math.round(textColorRgb[0])}, ${Math.round(
        textColorRgb[1]
      )}, ${Math.round(textColorRgb[2])})`
    };
  } catch (error) {
    console.warn("Failed to extract colors:", error);
    return {
      dominantColor: "rgb(200, 200, 200)",
      textColor: "rgb(230, 230, 230)"
    };
  }
}
