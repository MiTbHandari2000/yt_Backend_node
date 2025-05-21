import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandaler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";
import { match } from "assert";
import { parse } from "path";

/-------TODO: get all videos based on query, sort, pagination--------/;
const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  const matchCondition = {};

  if (query) {
    matchCondition.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
    matchCondition.owner = new mongoose.Types.ObjectId(userId);
  }
  matchCondition.isPublished = true;

  const sortConditions = {};
  if (sortBy && sortType) {
    const validSortFields = ["createdAt", "duration", "title", "views"];
    if (!validSortFields.includes(sortBy)) {
      sortConditions[sortBy] = sortType === "desc" ? -1 : 1;
    } else {
      sortConditions.createdAt = -1;
    }
  } else {
    sortConditions.createdAt = -1;
  }

  try {
    const videoAggregate = Video.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [
            {
              $project: {
                fullName: 1,
                userName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },

      {
        $unwind: "ownerDetails",
      },
      {
        $addFields: {
          owner: "ownerDetails",
        },
      },

      {
        $sort: sortConditions,
      },
    ]);

    const options = {
      page,
      limit,
      customLabels: {
        totalDocs: "totalVideos",
        docs: "videos",
      },
    };
    const result = await Video.aggregatePaginate(videoAggregate, options);
    if (
      !result ||
      (result.docs.length === 0 &&
        result.totalDocs > 0 &&
        page > result.totalPages)
    ) {
      // Requested page is out of bounds
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            videos: [],
            ...options,
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
          },
          "No videos found on this page."
        )
      );
    }
    if (!result || result.docs.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { videos: [], ...options, totalDocs: 0, totalPages: 0 },
            "No videos found matching your criteria."
          )
        );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Videos fetched successfully"));
  } catch (error) {
    console.error("Error fetching videos:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, error.message || "Internal server error"));
  }
});

/-------TODO: get video, upload to cloudinary, create video--------/;
const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
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

  const videoFileLocalPath = req.file?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.file?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail image is required");
  }

  let videoUploadResponse, thumbnailUploadResponse;

  try {
    videoUploadResponse = await uploadOnCloudinary(videoFileLocalPath);
    thumbnailUploadResponse = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoUploadResponse.url || videoUploadResponse) {
      throw new ApiError(500, "Failed to upload video file to Cloudinary.");
    }
    if (!thumbnailUploadResponse.url || thumbnailUploadResponse) {
      if (videoUploadResponse?.public_id) {
        await deleteFromCloudinary(videoUploadResponse.public_id, "video");
        throw new ApiError(
          500,
          "Failed to upload thumbnail image to Cloudinary."
        );
      }
    }
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
      if (videoUploadResponse?.public_id) {
        await deleteFromCloudinary(videoUploadResponse.public_id, "video");
      }
      if (thumbnailUploadResponse?.public_id) {
        await deleteFromCloudinary(thumbnailUploadResponse.public_id, "image");
      }
      throw new ApiError(
        500,
        video,
        " Failed to save video details to database."
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(201, video, "Video published successfully"));
  } catch (error) {
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath))
      fs.unlinkSync(videoFileLocalPath);
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath))
      fs.unlinkSync(thumbnailLocalPath);

    if (error instanceof ApiError) throw error;
    console.error("Error publishing video:", error);
    throw new ApiError(
      500,
      error.message || "An unexpected error occurred while publishing video."
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
