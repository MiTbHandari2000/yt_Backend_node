import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import { match } from "assert";

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
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
