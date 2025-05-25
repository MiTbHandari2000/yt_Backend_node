import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

/-------TODO: get all videos based on query, sort, pagination--------/;

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
});

/-------TODO get video, upload to cloudinary, create video--------/;

const publishAVideo = asyncHandler(async (req, res) => {
  // 1. Destructure and Validate Text Inputs & User Auth
  const { title, description, duration } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User is not authenticated");
  }

  if (!title.trim()) {
    throw new ApiError(400, "Title is required");
  }
  if (!description.trim()) {
    throw new ApiError(400, "Description is required");
  }
  if (isNaN(parseFloat(duration)) || parseFloat(duration) <= 0) {
    throw new ApiError(400, "Duration is required");
  }

  const videoFileObject = req.files?.videoFile?.[0];
  const thumbnailFileObject = req.files?.thumbnail?.[0];

  const videoFileLocalPath = videoFileObject?.path;
  const thumbnailLocalPath = thumbnailFileObject?.path;

  if (!videoFileLocalPath) {
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (e) {
        console.error(
          "Error cleaning up orphaned thumbnail (no video file):",
          e
        );
      }
    }

    throw new ApiError(400, "Video file is required");
  }
  if (!thumbnailLocalPath) {
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath)) {
      try {
        fs.unlinkSync(videoFileLocalPath);
      } catch (e) {
        console.error(
          "Error cleaning up orphaned video file (no thumbnail):",
          e
        );
      }
    }

    throw new ApiError(400, "Thumbnail image is required");
  }

  /- Validate File Types (MIME types) - Critical since using generic Multer upload-/;
  const allowedVideoMimes = [
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/avi",
  ]; // Add more as needed
  const allowedImageMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (
    !videoFileObject ||
    !allowedVideoMimes.includes(videoFileObject.mimetype)
  ) {
    // Cleanup both local files if video type is invalid
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath))
      try {
        fs.unlinkSync(videoFileLocalPath);
      } catch (e) {
        console.error("Cleanup error VT1:", e);
      }
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath))
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (e) {
        console.error("Cleanup error VT2:", e);
      }
    throw new ApiError(
      400,
      `Invalid video file type: ${videoFileObject?.mimetype}. Supported types include mp4, mov, etc.`
    );
  }

  if (
    !thumbnailFileObject ||
    !allowedImageMimes.includes(thumbnailFileObject.mimetype)
  ) {
    // Cleanup both local files if thumbnail type is invalid
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath))
      try {
        fs.unlinkSync(videoFileLocalPath);
      } catch (e) {
        console.error("Cleanup error TT1:", e);
      }
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath))
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (e) {
        console.error("Cleanup error TT2:", e);
      }
    throw new ApiError(
      400,
      `Invalid thumbnail file type: ${thumbnailFileObject?.mimetype}. Supported types: jpg, png, etc.`
    );
  }

  let videoUploadResponse, thumbnailUploadResponse;

  try {
    //5
    console.log("Attempting to upload video file:", videoFileLocalPath);
    videoUploadResponse = await uploadOnCloudinary(videoFileLocalPath);

    console.log("Attempting to upload thumbnail file:", thumbnailLocalPath);
    thumbnailUploadResponse = await uploadOnCloudinary(thumbnailLocalPath);

    //6

    if (!videoUploadResponse || !videoUploadResponse.url) {
      // If video upload failed, but thumbnail might have succeeded before this check
      if (thumbnailUploadResponse?.public_id) {
        console.log(
          "Video upload failed, attempting to delete already uploaded thumbnail from Cloudinary:",
          thumbnailUploadResponse.public_id
        );
        try {
          await deleteFromCloudinary(
            thumbnailUploadResponse.public_id,
            "image"
          );
        } catch (e) {
          console.error("Cloudinary cleanup error (thumbnail):", e);
        }
      }
      throw new ApiError(
        500,
        "Failed to upload video file to Cloudinary or response was invalid."
      );
    }

    if (!thumbnailUploadResponse || !thumbnailUploadResponse.url) {
      // If thumbnail upload failed, but video upload succeeded
      if (videoUploadResponse?.public_id) {
        console.log(
          "Thumbnail upload failed, attempting to delete already uploaded video from Cloudinary:",
          videoUploadResponse.public_id
        );
        try {
          await deleteFromCloudinary(videoUploadResponse.public_id, "video");
        } catch (e) {
          console.error("Cloudinary cleanup error (video):", e);
        }
      }
      throw new ApiError(
        500,
        "Failed to upload thumbnail image to Cloudinary or response was invalid."
      );
    }

    if (!thumbnailUploadResponse || !thumbnailUploadResponse.url) {
      // If thumbnail upload failed, but video upload succeeded
      if (videoUploadResponse?.public_id) {
        console.log(
          "Thumbnail upload failed, attempting to delete already uploaded video from Cloudinary:",
          videoUploadResponse.public_id
        );
        try {
          await deleteFromCloudinary(videoUploadResponse.public_id, "video");
        } catch (e) {
          console.error("Cloudinary cleanup error (video):", e);
        }
      }
      throw new ApiError(
        500,
        "Failed to upload thumbnail image to Cloudinary or response was invalid."
      );
    }
    //7
    const video = await Video.create({
      title: title.trim(),
      description: description.trim(),
      videoFile: videoUploadResponse.url,
      thumbnail: thumbnailUploadResponse.url,
      duration: parseFloat(duration) || videoUploadResponse.duration || 0,
      owner: userId,
      isPublished: true,
    });

    if (!video) {
      console.log(
        "DB video creation failed. Attempting to delete assets from Cloudinary."
      );
      if (videoUploadResponse?.public_id)
        try {
          await deleteFromCloudinary(videoUploadResponse.public_id, "video");
        } catch (e) {
          console.error("Cloudinary cleanup error (video after DB fail):", e);
        }
      if (thumbnailUploadResponse?.public_id)
        try {
          await deleteFromCloudinary(
            thumbnailUploadResponse.public_id,
            "image"
          );
        } catch (e) {
          console.error(
            "Cloudinary cleanup error (thumbnail after DB fail):",
            e
          );
        }
      throw new ApiError(
        500,
        "Failed to save video details to the database after successful uploads."
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(201, video, "Video published successfully"));
  } catch (error) {
    if (!(error instanceof ApiError)) {
      // Only log if it's not one we've explicitly thrown
      console.error("Unexpected error in publishAVideo catch block:", error);
    }
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath)) {
      try {
        fs.unlinkSync(videoFileLocalPath);
      } catch (e) {
        console.error("Final catch: Error unlinking video temp file:", e);
      }
    }
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (e) {
        console.error("Final catch: Error unlinking thumbnail temp file:", e);
      }
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      error.message ||
        "An unexpected error occurred while publishing the video."
    );
  }
});

/--------------TODO: get video by id-------------------/;
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  try {
    const video = await Video.findById(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate("owner", "userName avatar fullName");

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    if (
      !video.isPublished &&
      (!userId || video.owner._id.toString() !== userId.toString())
    ) {
      throw new ApiError(
        403,
        "Video is not published and you dont have permission to view it"
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video  details fetched successfully"));
  } catch (error) {
    console.error("Error fetching video:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || "failed to fetch video details");
  }
});

/-------ODO: update video details like title, description, thumbnail--------/;
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;
  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!userId) {
    throw new ApiError(401, "User is not authenticated");
  }

  if (!title?.trim() && !description?.trim() && !thumbnailLocalPath) {
    throw new ApiError(
      400,
      "Please provide title, description, or a new thumbnail to update."
    );
  }

  const video = await Video.findById(videoId);
  if (!video) {
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath))
      fs.unlinkSync(thumbnailLocalPath);
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath))
      fs.unlinkSync(thumbnailLocalPath);
    {
      throw new ApiError(403, "You are not authorized to update this video");
    }
  }
});

/-----TODO: delete video-----------------/;
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!userId) {
    throw new ApiError(401, "User is not authenticated");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  let videoFilePublicId = null;
  if (video.videoFile) {
    const urlParts = video.videoFile.split("/");
    const publicIdWithExtension = urlParts.pop();
    videoFilePublicId = publicIdWithExtension.substring(
      0,
      publicIdWithExtension.lastIndexOf(".")
    );
    const folderPath = urlParts
      .slice(
        urlParts.indexOf(process.env.CLOUDINARY_CLOUD_NAME) + 1,
        urlParts.length - 1
      )
      .join("/");
    if (folderPath) videoFilePublicId = `${folderPath}/${videoFilePublicId}`;
  }

  let thumbnailPublicId = null;
  if (video.thumbnail) {
    const urlParts = video.thumbnail.split("/");
    const publicIdWithExtension = urlParts.pop();
    thumbnailPublicId = publicIdWithExtension.substring(
      0,
      publicIdWithExtension.lastIndexOf(".")
    );
    const folderPath = urlParts
      .slice(
        urlParts.indexOf(process.env.CLOUDINARY_CLOUD_NAME) + 1,
        urlParts.length - 1
      )
      .join("/");
    if (folderPath) thumbnailPublicId = `${folderPath}/${thumbnailPublicId}`;
  }
  try {
    const deletionResult = await Video.findByIdAndDelete(videoId);
    if (!deletionResult) {
      throw new ApiError(
        404,
        "Failed to delete video from database or it was already deleted."
      );
    }
    if (videoFilePublicId) {
      await deleteFromCloudinary(videoFilePublicId, "video");
    }
    if (thumbnailPublicId) {
      await deleteFromCloudinary(thumbnailPublicId, "image");
    }
    await Like.deleteMany({ video: videoId });
    await Comment.deleteMany({ video: videoId });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videoId: deletionResult._id,
          message: "Video and associated assets deleted successfully.",
        },
        "Video deleted successfully."
      )
    );
  } catch (error) {
    console.error("Error deleting video:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      error.message || "An unexpected error occurred while deleting video."
    );
  }
});

/-----TODO: toggle publish status-----------------/;
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!userId) {
    throw new ApiError(401, "User is not authenticated");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (video.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  video.isPublished = !video.isPublished;
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videoId: video._id, isPublished: video.isPublished },
        `Video ${video.isPublished ? "published" : "unpublished"} successfully.`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
