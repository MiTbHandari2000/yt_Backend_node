import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
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

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
});

export { getChannelStats, getChannelVideos };
