import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

/-------TODO: get all videos based on query, sort, pagination--------/;

const getAllVideos = asyncHandler(async (req, res) => {
  const { query, sortBy, sortType, userId } = req.query;
  let { page = 1, limit = 10 } = req.query;

  // console.log("Received query param- page:",page,"limit:",limit,"query:",query,"sortBy:",sortBy,"sortType",sortType,"userId:",userId);

  page = page ? parseInt(page, 10) : 1;
  limit = limit ? parseInt(limit, 10) : 10;

  if (isNaN(page) || page < 1) {
    // console.log(`Invalid page value received:${req.query.page}, defaulting to 1.`);
    page = 1;
  }
  if (isNaN(limit) || limit < 1) {
    // console.log(`Invalid limit value received:${req.query.limit}, defaulting to 10.`);
    limit = 10;
  }
  if (limit > 50) {
    // console.log(`limit value ${limit} exceeds cap of 50  `);
    limit = 50;
  }

  //console.log(`Parsed pagination: page=${page}, limit=${limit}`);

  //step:2
  const matchCondition = {};
  if (query?.trim()) {
    matchCondition.$or = [
      { title: { $regex: query.trim(), $options: "i" } },
      { description: { $regex: query.trim(), $options: "i" } },
    ];
    // console.log(`text query added to matchcondition for :"${query.trim()}"`);
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "ivalid user id format for filtering. ");
    }
    matchCondition.owner = new mongoose.Types.ObjectId(userId);
    //console.log(`user id filter is added to matchcondition for owner:"${userId}" `);
  }

  matchCondition.isPublished = true;
  // console.log("default filter added :isPublished=true");

  //step-------3--------
  const sortCondition = {};

  const validSortFields = ["views", "duration", "createdAt", "title"];

  if (sortBy && validSortFields.includes(sortBy)) {
    sortCondition[sortBy] = sortType?.toLowerCase() === "desc" ? -1 : 1;
    /* console.log(
      `sorting applied: by  "${sortBy}",order "${sortType?.toLowerCase() === "desc" ? "desc" : "asc"}"`
    );*/
  } else {
    sortCondition.createdAt = -1;
    // console.log(`default sorting  applied:by "createdAt",order "desc`);
  }

  //step 4 & 5
  const aggregationPipeline = [
    // Stage 1: Initial filtering based on query, userId, isPublished
    {
      $match: matchCondition,
    },
    // Stage 2: Lookup owner information from the "users" collection
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetailsArray",
        pipeline: [
          {
            $project: {
              _id: 1,
              userName: 1,
              avatar: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    // Stage 3: Deconstruct the ownerDetailsArray
    {
      $unwind: {
        path: "$ownerDetailsArray",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Stage 4: Replace the original 'owner' ObjectId with the fetched owner object (or null)
    {
      $addFields: {
        owner: "$ownerDetailsArray",
      },
    },
    // Stage 5: Remove the temporary 'ownerDetailsArray' field as it's now redundant
    {
      $project: {
        ownerDetailsArray: 0,
      },
    },

    // Sorting the results
    {
      $sort: sortCondition,
    },
  ];
  //console.log("Full Aggregation Pipeline to be used:",JSON.stringify(aggregationPipeline, null, 2));

  //step 6 & 7
  const paginationOptions = {
    page: page,
    limit: limit,
    customLabels: {
      totalDocs: "totalVideos",
      docs: "videos",
    },
    lean: true,
  };

  console.log(
    "PaginationOption for Video.paginate:",
    JSON.stringify(paginationOptions, null, 2)
  );

  try {
    const videoAggregateObject = Video.aggregate(aggregationPipeline);
    //console.log("Type of Video.paginate:", typeof Video.paginate);
    if (
      videoAggregateObject &&
      typeof videoAggregateObject.pipeline === "function"
    ) {
      console.log(
        "Pipeline of AGGREGATE OBJECT passed to paginate:",
        JSON.stringify(videoAggregateObject.pipeline(), null, 2)
      );
    } else {
      console.error(
        "videoAggregateObject is not a valid  Mongoose aggregate instance!"
      );
      throw new ApiError(500, "Failed to create aggregation query");
    }

    const result = await Video.aggregatePaginate(
      videoAggregateObject,
      paginationOptions
    );
    console.log(
      "Result from Video.aggregatePaginate:",
      JSON.stringify(result, null, 2)
    );

    if (
      !result ||
      typeof result !== "object" ||
      !result.videos ||
      !Array.isArray(result.videos)
    ) {
      console.error(
        "Video.paginate returned an unexpected result structure.Actual result",
        result
      );
      throw new ApiError(
        500,
        "Failed to fetch videos: pagination plugin returned an invalid result structure"
      );
    }
    if (result.videos.length === 0) {
      if (page > 1 && result.totalVideos > 0 && page > result.totalPage) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              { ...result, videos: [] },
              "No videos found on this page "
            )
          );
      }
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            videos: [],
            totalVideos: 0,
            page: 1,
            limit,
            totalPage: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "No videos found matching your criteria"
        )
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Video fetched successfully "));
  } catch (error) {
    console.error("Error during Video.paginate or result handling :", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      error.message || "failed to fetch video due to an internal server error"
    );
  }
});

/-------TODO publish video, upload to cloudinary, create video--------/;

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
      videoFilePublicId: videoUploadResponse.public_id,
      videoFileResourceType: videoUploadResponse.resource_type,
      thumbnail: thumbnailUploadResponse.url,
      thumbnailPublicId: thumbnailUploadResponse.public_id,
      thumbnailResourceType: thumbnailUploadResponse.resource_type,
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
    const video = await Video.findByIdAndUpdate(
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

/-------TODO: update video details like title, description, thumbnail--------/;
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
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (error) {
        console.error("Error unlinking thumbnail file:", error);
      }
    }
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== userId.toString()) {
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      try {
        fs.unlinkSync(thumbnailLocalPath);
      } catch (error) {
        console.error("Error unlinking temp thumbnail (unauthorized):", error);
      }
    }
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const updateData = {};
  if (title?.trim() && video.title !== title.trim()) {
    updateData.title = title.trim();
  }

  if (description?.trim() && video.description !== description.trim()) {
    updateData.description = description.trim();
  }

  let oldThumbnailPublicId = null;
  let newThumbnailCloudinaryResponse = null;

  if (thumbnailLocalPath) {
    console.log(
      "New thumbnail provided, processing upload...",
      thumbnailLocalPath
    );
    newThumbnailCloudinaryResponse =
      await uploadOnCloudinary(thumbnailLocalPath);

    if (
      !newThumbnailCloudinaryResponse ||
      !newThumbnailCloudinaryResponse.url
    ) {
      throw new ApiError(
        500,
        "Failed to upload new thumbnail  to Cloudinary.Video not updated."
      );
    }
    updateData.thumbnail = newThumbnailCloudinaryResponse.url;

    if (video.thumbnail) {
      try {
        const urlParts = video.thumbnail.split("/");
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        if (publicIdWithExtension) {
          oldThumbnailPublicId = publicIdWithExtension.substring(
            0,
            publicIdWithExtension.lastIndexOf(".")
          );
          const folderPath = urlParts
            .slice(
              urlParts.findIndex(
                (part) => part === process.env.CLOUDINARY_CLOUD_NAME
              ) + 1,
              urlParts.length - 1
            )
            .join("/");

          if (folderPath && !oldThumbnailPublicId.startsWith(folderPath)) {
            oldThumbnailPublicId = `${folderPath}/${oldThumbnailPublicId}`;
          }
        }
      } catch (error) {
        console.error(
          "Error parsing public_id from old thumbnail URL:",
          video.thumbnail,
          error
        );
      }
    }
  }
  if (Object.keys(updateData).length === 0) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          video,
          "No changes provided or detected. Video not updated."
        )
      );
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,

    { $set: updateData },
    {
      new: true,
      runValidators: true, // Ensure validation is applied on update
    }
  ).populate("owner", "userName avatar fullName");

  if (!updateVideo) {
    if (newThumbnailCloudinaryResponse?.public_id) {
      try {
        await deleteFromCloudinary(
          newThumbnailCloudinaryResponse.public_id,
          "image"
        );
      } catch (error) {
        console.error(
          "Error deleting new thumbnail from Cloudinary after DB failed update:",
          error
        );
      }
    }
    throw new ApiError(500, "Failed to update video details in the database.");
  }

  if (
    oldThumbnailPublicId &&
    newThumbnailCloudinaryResponse?.url &&
    video.thumbnail !== newThumbnailCloudinaryResponse.url
  ) {
    console.log(
      "Attempting to delete old thumbnail from Cloudinary:",
      oldThumbnailPublicId
    );
    try {
      await deleteFromCloudinary(oldThumbnailPublicId, "image");
      console.log("Old thumbnail deleted successfully from Cloudinary.");
    } catch (error) {
      console.error(
        "Failed to delete old thumbnail from Cloudinary (but DB was updated):",
        error
      );
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
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

  const videoFilePublicIdToDelete = video.videoFilePublicId;
  const videoFileResType = video.videoFileResourceType || "video"; // Fallback if not stored
  const thumbnailPublicIdToDelete = video.thumbnailPublicId;
  const thumbnailResType = video.thumbnailResourceType || "image";

  try {
    // 4. Delete the video document from MongoDB first
    const deletionResultFromDB = await Video.findByIdAndDelete(videoId);
    if (!deletionResultFromDB) {
      throw new ApiError(
        404,
        "Video not found during deletion (it may have already been deleted)."
      );
    }

    // 5. If DB deletion was successful, proceed to delete from Cloudinary
    let cloudinaryVideoDeleted = false;
    let cloudinaryThumbnailDeleted = false;

    if (videoFilePublicIdToDelete) {
      console.log(
        `Attempting to delete VIDEO from Cloudinary: public_id='${videoFilePublicIdToDelete}', resource_type='${videoFileResType}'`
      );
      const cdVideoResult = await deleteFromCloudinary(
        videoFilePublicIdToDelete,
        videoFileResType
      );
      if (
        cdVideoResult &&
        (cdVideoResult.result === "ok" || cdVideoResult.result === "not found")
      ) {
        cloudinaryVideoDeleted = true;
        console.log("Cloudinary video deletion status:", cdVideoResult.result);
      } else {
        console.warn(
          "Cloudinary video asset deletion may have failed or returned unexpected result:",
          cdVideoResult
        );
      }
    } else {
      console.log(
        "No videoFilePublicId found in DB record, skipping Cloudinary video deletion."
      );
      cloudinaryVideoDeleted = true;
    }

    if (thumbnailPublicIdToDelete) {
      console.log(
        `Attempting to delete THUMBNAIL from Cloudinary: public_id='${thumbnailPublicIdToDelete}', resource_type='${thumbnailResType}'`
      );
      const cdThumbResult = await deleteFromCloudinary(
        thumbnailPublicIdToDelete,
        thumbnailResType
      );
      if (
        cdThumbResult &&
        (cdThumbResult.result === "ok" || cdThumbResult.result === "not found")
      ) {
        cloudinaryThumbnailDeleted = true;
        console.log(
          "Cloudinary thumbnail deletion status:",
          cdThumbResult.result
        );
      } else {
        console.warn(
          "Cloudinary thumbnail deletion may have failed or returned unexpected result:",
          cdThumbResult
        );
      }
    } else {
      console.log(
        "No thumbnailPublicId found in DB record, skipping Cloudinary thumbnail deletion."
      );
      cloudinaryThumbnailDeleted = true;
    }

    // 6. Delete associated likes and comments
    await Like.deleteMany({ video: videoId });
    console.log(`Deleted likes associated with video ${videoId}`);
    await Comment.deleteMany({ video: videoId });
    console.log(`Deleted comments associated with video ${videoId}`);

    // TODO: Remove this videoId from any playlists it might be in (advanced).

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          deletedVideoId: deletionResultFromDB._id,
          cloudinaryVideoAssetStatus: cloudinaryVideoDeleted
            ? "processed"
            : "failed_or_not_found_in_cd",
          cloudinaryThumbnailAssetStatus: cloudinaryThumbnailDeleted
            ? "processed"
            : "failed_or_not_found_in_cd",
          message: "Video and associated data processed for deletion.",
        },
        "Video deletion process completed."
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
