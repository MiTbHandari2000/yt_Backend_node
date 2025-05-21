import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandaler.js";

/-TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc-/;
const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }
  try {
    const [
      totalVideos,
      totalSubscribers,
      videoStatsResult,
      userVideoStatsResult,
    ] = await Promise.all([
      Video.countDocuments({ owner: userId }),
      Subscription.countDocuments({ channel: userId }),

      Video.aggregate([
        {
          $match: {
            owner: mongoose.Types.ObjectId(userId),
          },
        },
        {
          $group: {
            _id: null,
            totalViews: { $sum: "$views" },
          },
        },
      ]),
      Video.find({ owner: userId }).select("_id"),
    ]);

    const totalViews = videoStatsResult[0]?.totalViews || 0;

    const userVideoIds = userVideoStatsResult.map((video) => video._id);
    let totalLikeOnUserVideos = 0;
    if (userVideoIds.length > 0) {
      totalLikeOnUserVideos = await Like.countDocuments({
        video: { $in: userVideoIds },
      });
    }

    const stats = {
      totalVideos,
      totalSubscribers,
      totalViewsOnChannel,
      totalLikeOnUserVideos,
      channelId: userId,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, "Channel statistics fetched successfully", stats)
      );
  } catch (error) {
    console.error("Error fetching channel stats:", error);
    if (error instanceof mongoose.Error.CastError) {
      throw new ApiError(
        400,
        "Invalid ID format encountered while fetching channel stats"
      );
    }
    throw new ApiError(
      500,
      error.message || "Failed to fetch channel statistics due to server error"
    );
  }
});

/-------TODO: Get all the videos uploaded by the channel--------/;
const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  let { page = 1, limit = 10 } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

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
    const videosQuery = Video.find({ owner: userId })

      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "title description thumbnail videoFile views duration createdAt isPublished"
      );

    const [videos, totalVideosCount] = await Promise.all([
      videosQuery.exec(),
      Video.countDocuments({ owner: userId }),
    ]);

    if (totalVideosCount === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            videos: [],
            totalVideos: 0,
            page: 1,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "This channel has no videos yet"
        )
      );
    }
    const responseData = {
      videos,
      totalVideos: totalVideosCount,
      currentPage: page,
      limitPerPage: limit,
      totalPages,
      hasNextpage,
      hasPrevPage,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Channel videos fetched successfully."
        )
      );
  } catch (error) {
    console.log("Error fetching channel videos:", error);
    if (error instanceof mongoose.Error.CastError) {
      throw new ApiError(
        400,
        "Invalid ID format encountered while fetching channel videos"
      );
    }
    throw new ApiError(
      500,
      error.message || "Failed to fetch channel videos due to server error"
    );
  }
});

export { getChannelStats, getChannelVideos };
