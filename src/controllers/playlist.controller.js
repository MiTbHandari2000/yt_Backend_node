import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandaler.js";

/--------------------TODO: create playlist-------------------/;
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(
      401,
      "User not Unauthorized, please login to create a playlist"
    );
  }

  if (!name.trim()) {
    throw new ApiError(400, "Playlist name is required");
  }

  const playlist = await Playlist.create({
    name: name.trim(),
    description: description.trim(),
    owner: userId,
    videos: [],
  });

  if (!playlist) {
    throw new ApiError(500, "Failed to create playlist");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

/--------------TODO: get user playlists-------------------/;
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  if (!isNaN(page) || page < 1) page = 1;
  if (!isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  try {
    const playlistAggregate = await Playlist.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "playlistVideos",
          pipeline: [
            { limit: 5 },
            {
              $project: { thumbnail: 1 },
            },
          ],
        },
      },

      {
        $addFields: {
          videoCount: { $size: "$videos" },
          previewThumbnails: "$playlistVideos.thumbnail",
        },
      },

      {
        $project: {
          playlistVideos: 0,
        },
      },
      {
        $sort: { updatedAt: -1 },
      },
    ]);

    const options = {
      page,
      limit,
      customLabels: {
        totalDocs: "totalPlaylists",
        docs: "playlists",
      },
    };

    const result = await Playlist.aggregatePaginate(playlistAggregate, options);

    if (
      !result ||
      (result.playlists.length === 0 && result.totalPlaylists === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            playlists: [],
            totalPlaylists: 0,
            ...options,
            totalpages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "No playlists found for this user on this page"
        )
      );
    }
    if (!result || result.playlists.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            playlists: [],
            totalPlaylists: 0,
            page: 1,
            limit,
            totalpages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "This user has not created any playlists yet"
        )
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, result, "User's playlists fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching playlists:", error);
    throw new ApiError(
      500,
      error.message || "An error occurred while fetching playlists"
    );
  }
});

/----------------------TODO: get playlist by id-------------------/;
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  try {
    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      throw new ApiError(404, "Playlist not found");
    }

    const videoIds = playlist.videos;
    const paginatedVideoIds = videoIds.slice((page - 1) * limit, page * limit);

    const populatedVideos = await Video.find({
      _id: { $in: paginatedVideoIds },
    })
      .populate("owner", "userName avatar fullName")
      .select("title thumbnail duration views createdAt owner videoFile");

    const playlistWithPaginatedVideos = {
      ...playlist.toObject(),
      videos: populatedVideos,
      pagination: {
        totalVideos: videoIds.length,
        currentPage: page,
        limitPage: limit,
        totalPages: Math.ceil(videoIds.length / limit),
        hasNextPage: page < Math.ceil(videoIds.length / limit),
        hasPrevPage: page > 1,
      },
    };

    await User.populate(playlistWithPaginatedVideos, {
      path: "owner",
      select: "userName avatar fullName",
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          playlistWithPaginatedVideos,
          "Playlist fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching playlist by id  :", error);
    throw new ApiError(
      500,
      error.message || "An error occurred while fetching playlist"
    );
  }
});

/---------TODO: add video to playlist------------/;
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not Unauthorized");
  }
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video already exists in the playlist");
  }

  playlist.videos.push(videoId);
  const updatedPlaylist = await playlist.save();

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to update playlist");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video added to playlist successfully"
      )
    );
});

/----------------TODO: remove video from playlist----------------/;
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User not Unauthorized");
  }
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  const videoIndex = playlist.videos.findIndex(
    (vId) => vId.toString() === videoId
  );
  if (videoIndex === -1) {
    throw new ApiError(404, "Video not found in the playlist");
  }

  playlist.videos.splice(videoIndex, 1);
  const updatedPlaylist = await playlist.save();

  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to remove video from playlist");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video removed from playlist successfully"
      )
    );
});

/--------------------TODO: delete playlist--------------------/;
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not Unauthorized");
  }
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this playlist");
  }

  const deletionResult = await Playlist.findByIdAndDelete(playlistId);

  if (!deletionResult) {
    throw new ApiError(500, "Failed to delete playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { playlistId: deletionResult._id },
        "Playlist deleted successfully"
      )
    );
});

/----------------TODO: update playlist--------------------/;
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User not Unauthorized");
  }
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  if (!name.trim() && (description === undefined || description?.trim())) {
    throw new ApiError(
      400,
      "Either name or description msut be provided to update"
    );
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to update this playlist");
  }

  if (name?.trim()) {
    playlist.name = name.trim();
  }
  if (description !== undefined) {
    playlist.description = description?.trim();
  }

  const updatedPlaylist = await playlist.save({ validateBeforeSave: true });
  if (!updatedPlaylist) {
    throw new ApiError(500, "Failed to update playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
