import mongoose, { Aggregate } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  if (!videoId?.trim() || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Valid Video ID is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  const commentsAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              userName: 1,
              avatar: 1,
              _id: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: { $first: "$ownerDetails" },
      },
    },
    {
      $project: {
        ownerDetails: 0,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  const options = {
    page,
    limit,
    customLabels: {
      totalDocs: "totalComments",
      docs: "comments",
    },
  };

  try {
    const result = await Comment.aggregatePaginate(commentsAggregate, options);
    if (
      !result ||
      (result.comments.length === 0 && result.totalComments === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            comments: [],
            totalComments: 0,
            page: page,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "No Comments found for this video"
        )
      );
    }
    return res
      .status(200)
      .json(new ApiResponse(200, result, "comments fetched successfully"));
  } catch (error) {
    console.error("Error fetching commnets", error);
    throw new ApiError(
      500,
      "Failed to fetch the comments due to internal error"
    );
  }
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;

  if (!videoId?.trim() || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Valid Video ID is required");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user._id,
  });

  if (!comment) {
    throw new ApiError(500, "Failed to add comment due to server error");
  }

  const populatedComment = await Comment.findById(comment._id).populate(
    "owner",
    "userName avatar"
  );
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        populatedComment || comment,
        "Comment added successfully"
      )
    );
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
});

export { getVideoComments, addComment, updateComment, deleteComment };
