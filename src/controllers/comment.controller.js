import mongoose, { Aggregate } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/-------TODO: get all comments for a video-----------------/;
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = page ? parseInt(page, 10) : 1;
  limit = limit ? parseInt(limit, 10) : 10;
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
    lean: true,
  };

  try {
    const result = await Comment.aggregatePaginate(commentsAggregate, options);
    if (
      !result ||
      typeof result !== "object" ||
      !result.comments ||
      !Array.isArray(result.comments)
    ) {
      console.error(
        "Comment.paginate returned an unexpected result structure:",
        result
      );
      throw new ApiError(
        500,
        "Failed to fetch comments: invalid pagination result structure."
      );
    }
    if (result.comments.length === 0) {
      if (page > 1 && result.totalComments > 0 && page > result.totalPages) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              { ...result, comments: [] },
              "No comments found on this page."
            )
          );
      }
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

/------TODO: add a comment to a video------------------/;
const addComment = asyncHandler(async (req, res) => {
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
        201,
        populatedComment || comment,
        "Comment added successfully"
      )
    );
});

/------TODO: update a comment-------------------/;
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?._id;

  if (!commentId?.trim() || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Valid Comment ID is required");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }
  if (!userId) {
    throw new ApiError(401, "User is not authenticated to update comment ");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  comment.content = content;
  const updatedCommentInstance = await comment.save({
    validateBeforeSave: true,
  });

  if (!updatedCommentInstance) {
    throw new ApiError(500, "Failed to update comment due to server error");
  }

  const populatedComment = await Comment.findById(
    updatedCommentInstance._id
  ).populate("owner", "userName avatar");
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        populatedComment || updatedCommentInstance,
        "Comment updated successfully"
      )
    );
});

/------TODO: delete a comment-----------------/;
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;

  if (!commentId?.trim() || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Valid Comment ID is required");
  }

  if (!userId) {
    throw new ApiError(401, "User is not authenticated to delete comment ");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  const deletionResult = await Comment.findByIdAndDelete(commentId);
  if (!deletionResult) {
    throw new ApiError(500, "Failed to delete comment due to server error");
  }
  await Like.deleteMany({ comment: commentId });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { deletedCommentId: deletionResult._id },
        "Comment deleted successfully"
      )
    );
});

export { getVideoComments, addComment, updateComment, deleteComment };
