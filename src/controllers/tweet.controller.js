import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/-----TODO: create tweet-----------------/;
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Tweet content is required");
  }

  if (content.length > 280) {
    throw new ApiError(
      400,
      "Tweet content exceeds the maximum length of 280 characters"
    );
  }

  if (!req.user?._id) {
    throw new ApiError(401, "User is not authenticated");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user._id,
  });

  if (!tweet) {
    throw new ApiError(500, "Failed to create tweet due to server error");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

/------TODO: get user tweets-----------------/;
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Valid User ID is required");
  }

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  try {
    const tweetsAggregate = Tweet.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [{ $project: { userName: 1, avatar: 1 } }],
        },
      },

      {
        $addFields: {
          owner: {
            $first: "$ownerDetails",
          },
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
        totalDocs: "totalTweets",
        docs: "tweets",
      },
    };

    const result = await Tweet.aggregatePaginate(tweetsAggregate, options);

    if (
      !result ||
      (result.tweets.length === 0 && result.totalTweets === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            tweets: [],
            totalTweets: 0,
            page: page,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "No Tweets found for this user on this page"
        )
      );
    }

    if (!result || result.tweets.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            tweets: [],
            totalTweets: 0,
            page: page,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          " This user has not posted any tweets yet"
        )
      );
    }
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Tweets fetched successfully"));
  } catch (error) {
    console.log("Error fetching tweets", error);
    throw new ApiError(500, error.message || "failed to fetch user  tweets");
  }
});

/-------TODO: update tweet------------------/;
const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "User not Authenticated");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "inValid Tweet ID ");
  }
  if (!content?.trim()) {
    throw new ApiError(400, "tweet content cannot be empty");
  }
  if (content.length > 280) {
    throw new ApiError(
      400,
      "tweet content exceeds the maximum length of 280 characters"
    );
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "tweet not found");
  }

  if (tweet.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "you're not authorized to update this tweet");
  }

  tweet.content = content.trim();
  const updatedTweet = await tweet.save({ validateBeforeSave: true });

  if (!updatedTweet) {
    throw new ApiError(500, "Fail to update tweet. Try again ");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "tweet updated successfully"));
});

/------TODO: delete tweet-----------------/;
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "user not Authenticated");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "invalid Tweet Id");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "tweet not found");
  }

  if (tweet.owner.toString() !== userId.toString()) {
    throw new ApiError(403, "you're not authorized to delete this tweet");
  }

  const deletionResult = await Tweet.findByIdAndDelete(tweetId);

  if (!deletionResult) {
    throw new ApiError(
      500,
      "Fail to delete the tweet. or it's already deleted"
    );
  }

  await Like.deleteMany({ tweet: tweetId });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { tweetId: deletionResult._id, message: "tweet deleted successfully" },
        "tweet deleted successfully"
      )
    );
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
