import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

//get channel stats  ;
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
            owner: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
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
      totalViews, // FIXED: Variable name was incorrect (totalViewsOnChannel)
      totalLikeOnUserVideos,
      channelId: userId,
    };

    return res.status(200).json(
      new ApiResponse(200, stats, "Channel statistics fetched successfully") // FIXED: Corrected parameter order
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

//TODO: Get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  let {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
    search,
  } = req.query;

  // Parse and validate pagination parameters
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

  // Validate sort parameters
  const validSortFields = ["createdAt", "title", "views", "duration"];
  if (!validSortFields.includes(sortBy)) {
    sortBy = "createdAt";
  }

  const sortOrder = sortType === "asc" ? 1 : -1;

  try {
    // Build match criteria
    const matchCriteria = { owner: userId };

    // Add search functionality if search query provided
    if (search && search.trim()) {
      matchCriteria.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Create sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder;

    const videosQuery = Video.find(matchCriteria)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "title description thumbnail videoFile views duration createdAt isPublished"
      );

    const [videos, totalVideosCount] = await Promise.all([
      videosQuery.exec(),
      Video.countDocuments(matchCriteria),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalVideosCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    if (totalVideosCount === 0) {
      const emptyMessage = search
        ? `No videos found matching "${search}"`
        : "This channel has no videos yet";

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            videos: [],
            totalVideos: 0,
            currentPage: page,
            limitPerPage: limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            searchQuery: search || null,
          },
          emptyMessage
        )
      );
    }

    const responseData = {
      videos,
      totalVideos: totalVideosCount,
      currentPage: page,
      limitPerPage: limit,
      totalPages, // FIXED: Variable was undefined
      hasNextPage, // FIXED: Variable name was incorrect (hasNextpage)
      hasPrevPage, // FIXED: Variable was undefined
      searchQuery: search || null,
      sortBy,
      sortType,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Channel videos fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching channel videos:", error);
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
