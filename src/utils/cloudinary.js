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

export { uploadOnCloudinary };
