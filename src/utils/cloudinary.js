import { v2 as cloudinary } from "cloudinary";

import fs from "fs";

/-CLOUDINARY CONFIGURATION-/;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/-THE PATH TO THE FILE ON LOCAL SERVER WHERE NEED TO BE UPLOADED BEFORE SENDIG TO CLOUD-/;
const uploadOnCloudinary = async (localFilePath) => {
  console.log("[uploadOnCloudinary] Received localFilePath:", localFilePath);
  console.log(
    "[uploadOnCloudinary] Type of localFilePath:",
    typeof localFilePath
  );

  try {
    // Now, the check for a falsy or empty path

    if (
      !localFilePath ||
      typeof localFilePath !== "string" ||
      localFilePath.trim() === ""
    ) {
      console.warn(
        "[uploadOnCloudinary] Invalid or empty localFilePath provided. Aborting upload. Path was:",
        localFilePath
      );
      return null;
    }
    /-USES CLOUDINARY'S UPLOADER.UPLOAD METHOD TO UPLOAD THE FILE -/;

    console.log(
      "[uploadOnCloudinary] Attempting to upload to Cloudinary:",
      localFilePath
    );
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log(
      "[uploadOnCloudinary] Successfully uploaded to Cloudinary. URL:",
      response.url
    );

    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(
          "[uploadOnCloudinary] Successfully deleted local temp file:",
          localFilePath
        );
      } else {
        // This case might occur if the file was somehow moved/deleted between upload and unlink
        console.warn(
          "[uploadOnCloudinary] Local temp file not found for deletion after successful upload (already gone?):",
          localFilePath
        );
      }
    } catch (unlinkError) {
      console.error(
        "[uploadOnCloudinary] Error deleting local temp file after successful Cloudinary upload (operation continued):",
        localFilePath,
        unlinkError
      );
      // Do not re-throw; the Cloudinary upload was successful. This is a cleanup issue.
    }

    return response;
  } catch (error) {
    console.error(
      "[uploadOnCloudinary] Error during Cloudinary upload process:",
      error
    );
    try {
      if (
        localFilePath &&
        typeof localFilePath === "string" &&
        fs.existsSync(localFilePath)
      ) {
        fs.unlinkSync(localFilePath);
        console.log(
          "[uploadOnCloudinary] Deleted local temp file after Cloudinary upload FAILURE:",
          localFilePath
        );
      }
    } catch (unlinkErrorInCatch) {
      console.error(
        "[uploadOnCloudinary] Error deleting local temp file in CATCH block (after Cloudinary failure):",
        localFilePath,
        unlinkErrorInCatch
      );
    }
    return null;
  }
};
/----------------------deleteFromCloudinary----------------------/;
const deleteFromCloudinary = async (publicId, resourceType) => {
  if (!publicId) {
    console.warn("Cloudinary Delete: No public ID provided for deletion");
    return null;
  }
  const validResourceTypes = ["image", "video", "raw"];
  if (!validResourceTypes.includes(resourceType)) {
    console.error(
      `Cloudinary Delete: Invalid resource type "${resourceType}".  For publicId: ${publicId}. Must be one of ${validResourceTypes.join(", ")}.`
    );

    return null;
  }

  try {
    console.log(
      `Attempting to delete from Cloudinary: public_id='${publicId}', resource_type='${resourceType}'`
    );
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      // invalidate: true, // Optional: to invalidate CDN cache immediately
    });
    console.log(`Cloudinary Deletion Result for ${publicId}:`, result);
    if (result.result === "ok" || result.result === "not found") {
      return result;
    } else {
      console.warn(
        `Cloudinary Deletion for ${publicId} returned unexpected result:`,
        result
      );
      return result;
    }
  } catch (error) {
    console.error(
      `Cloudinary Delete Error for public_id ${publicId} (resource_type ${resourceType}):`,
      error
    );
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
