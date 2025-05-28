import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/-------------TODO: toggle like on video-------------------/;
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const likeCondition = {
    video: videoId,
    likedBy: userId,
  };

  const existingLike = await Like.findOne(likeCondition);

  let responseMessage = "";
  let statusCode = 200;
  let liked = false;
  let likeData = null;

  try {
    if (existingLike) {
      const deletedLike = await Like.findByIdAndDelete(existingLike._id);
      if (!deletedLike) {
        throw new ApiError(500, "Failed to delete like");
      }
      responseMessage = "Video unliked successfully";
      liked = false;
      statusCode = 200;
      likeData = { videoId, likedBy: userId, liked: false };
    } else {
      const newLike = await Like.create(likeCondition);
      if (!newLike) {
        throw new ApiError(500, "Failed to like video");
      }
      responseMessage = "Video liked successfully";
      liked = true;
      statusCode = 201;
      likeData = { videoId, likedBy: userId, liked: true, likeId: newLike._id };
    }

    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, likeData, responseMessage));
  } catch (error) {
    console.error("Error toggling video like:", error);
    throw new ApiError(
      500,
      error.message || "an unexpected error occurred while toggling video like"
    );
  }
});

/------------TODO: toggle like on comment--------------------/;
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }
  if (!userId) {
    throw new ApiError(401, "user not authorized");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const likeCondition = {
    comment: commentId,
    likedBy: userId,
  };

  const existingLike = await Like.findOne(likeCondition);
  let responseMessage = "";
  let statusCode = 200;
  let liked = false;
  let likeData = null;

  try {
    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      responseMessage = "Comment unliked successfully";
      liked = false;
      likeData = { commentId, likedBy: userId, liked: false };
    } else {
      const newLike = await Like.create(likeCondition);

      responseMessage = "Comment liked successfully";
      liked = true;
      statusCode = 201;
      likeData = {
        commentId,
        likedBy: userId,
        liked: true,
        likeId: newLike._id,
      };
      return res
        .status(statusCode)
        .json(new ApiResponse(statusCode, responseMessage, likeData));
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw new ApiError(
      500,
      error.message ||
        "an unexpected error occurred while toggling comment like"
    );
  }
});

/---------TODO: toggle like on tweet-------------------/;
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user?._id;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }
  if (!userId) {
    throw new ApiError(401, "user not authorized");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const likeCondition = {
    tweet: tweetId,
    likedBy: userId,
  };

  const existingLike = await Like.findOne(likeCondition);
  let responseMessage = "";
  let statusCode = 200;
  let liked = false;
  let likeData = null;

  try {
    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      responseMessage = "Tweet unliked successfully";
      liked = false;
      likeData = { tweetId, likedBy: userId, liked: false };
    } else {
      const newLike = await Like.create(likeCondition);
      responseMessage = "Tweet liked successfully";
      liked = true;
      statusCode = 201;
      likeData = {
        tweetId,
        likedBy: userId,
        liked: true,
        likeId: newLike._id,
      };
      return res
        .status(statusCode)
        .json(new ApiResponse(statusCode, responseMessage, likeData));
    }
  } catch (error) {
    console.error("Error toggling tweet like:", error);
    throw new ApiError(
      500,
      error.message || "an unexpected error occurred while toggling tweet like"
    );
  }
});

/------TODO: get all liked videos------------------/;
const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized to access liked videos");
  }

  let { page = 1, limit = 10 } = req.query;
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }
  if (isNaN(limit) || limit < 1) {
    limit = 10;
  }
  if (limit > 50) {
    limit = 50;
  }

  try {
    const likedVideosAggregate = await Like.aggregate([
      {
        $match: {
          likedBy: mongoose.Types.ObjectId(userId),
          video: { $ne: null, $exists: true },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "likedVideoDetails",
          pipeline: [
            {
              $project: {
                title: 1,
                thumbnail: 1,
                videoFile: 1,
                duration: 1,
                views: 1,
                createdAt: 1,
                owner: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$likedVideoDetails",
      },
      {
        $lookup: {
          from: "users",
          localField: "likedVideoDetails.owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [
            {
              $project: {
                userName: 1,
                avatar: 1,
                fullName: 1,
              },
            },
          ],
        },
      },

      {
        $addFields: {
          "likedVideoDetails.ownerDetails": {
            $first: "$ownerDetails",
          },
        },
      },

      {
        $replaceRoot: { $newRoot: "$likedVideoDetails" },
      },

      {
        $project: {
          ownerDetails: 0,
        },
      },
    ]);

    const options = {
      page: page,
      limit: limit,
      customLabels: {
        totalDocs: "totalLikedVideos",
        docs: "likedVideos",
      },
    };

    const result = await Like.aggregatePaginate(likedVideosAggregate, options);

    if (
      !result ||
      (result.docs.length === 0 && result.totalDocs === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            likedVideos: [],
            totalLikedVideos: result?.totalDocs || 0,
            currentPage: page,
            totalPages: result?.totalPages || 0,
            hasNextPage: false,
            hasPrevPage: result?.totalPages > 1,
          },
          "No liked videos found on this page."
        )
      );
    }
    if (!result || result.docs.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            likedVideos: [],
            totalLikedVideos: 0,
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "You haven't liked any videos yet."
        )
      );
    }
    const responseData = {
      likedVideos: result.docs,
      totalLikedVideos: result.totalDocs,
      limit: result.limit,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      nextPage: result.nextPage,
      prevPage: result.prevPage,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Liked videos retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error retrieving liked videos:", error);
    throw new ApiError(500, error.message || "Failed to fetch liked videos");
  }
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
