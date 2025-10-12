import fs from "fs";
import path from "path";

// Helper function to find moment by file hash
export const findMomentByHash = (momentsDir, fileHash) => {
  if (!fs.existsSync(momentsDir)) {
    return null;
  }

  const momentDirs = fs.readdirSync(momentsDir);

  for (const momentDir of momentDirs) {
    const metadataPath = path.join(momentsDir, momentDir, "metadata.json");
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        if (metadata.fileHash === fileHash) {
          return metadata.id;
        }
      } catch (e) {
        // Skip invalid metadata files
        continue;
      }
    }
  }

  return null;
};
