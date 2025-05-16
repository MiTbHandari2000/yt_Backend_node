import { v2 as cloudinary } from "cloudinary";
import { log } from "console";
import fs from "fs";

/-------CLOUDINARY CONFIGURATION-------/;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/-THE PATH TO THE FILE ON LOCAL SERVER WHERE NEED TO BE UPLOADED BEFORE SENDIG TO CLOUD-/;
const uploadOnCloudinary = async (localFilePath) => {
  try {
    /-IF FILE PATH NOT FOUND-/;
    if (!localFilePath) return null;

    /-USES CLOUDINARY'S UPLOADER.UPLOAD METHOD TO UPLOAD THE FILE -/;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    //console.log("file is uploaded on cloudinary", response.url);
    /----IF FILE GETS UPLOADED TO CLOUDINARY FS.UNLINKSYNC WILL  REMOVE FROM OUR SERVER-LOCALPATH---/;

    fs.unlinkSync(localFilePath);
    //console.log(response);

    /-RESPONSE RETURNS USEFUL INFORMATION LIKE PUBLIC URL OF UPLOADED FILE -/;

    return response;
  } catch (error) {
    /-DUE TO SOME ERROR IF FILE WAS NOT UPLOADED IT WILL REMOVE THE FILE FROM LOCALPATH-/;

    fs.unlinkSync(localFilePath); //remove the temporary saved file if upload fail
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
