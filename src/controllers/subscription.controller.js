import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/-------TODO: toggle subscription----------------/;
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user?._id;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  if (!subscriberId) {
    throw new ApiError(
      401,
      "User not authenticated. Please log in to subscribe"
    );
  }

  if (channelId.toString() === subscriberId.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const channelExists = await User.findById(channelId);
  if (!channelExists) {
    throw new ApiError(404, "Channel not found");
  }

  const subscriptionCondition = {
    channel: channelId,
    subscriber: subscriberId,
  };
  const existingSubcription = await Subscription.findOne(subscriptionCondition);

  let responseMessage = "";
  let statusCode = 200;
  //let subscribed = false;
  let subscriptionData = null;

  try {
    if (existingSubcription) {
      const deletedSubscription = await Subscription.findByIdAndDelete(
        existingSubcription._id
      );

      if (!deletedSubscription) {
        throw new ApiError(500, "Fail to unsubscribe the channel");
      }
      responseMessage = "Unsubscribed successfully";
      //subscribed = false;
      subscriptionData = { channelId, subscriberId, subscribed: false };
      statusCode = 200;
    } else {
      const newSubscription = await Subscription.create(subscriptionCondition);
      if (!newSubscription) {
        throw new ApiError(500, "Fail to subscribe the channel");
      }
      responseMessage = "Subscribed successfully";
      // subscribed = true;
      statusCode = 201;
      subscriptionData = {
        channelId,
        subscriberId,
        subscribed: true,
        subscriptionId: newSubscription._id, //made change here
      };
    }

    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, subscriptionData, responseMessage)); //order changed here
  } catch (error) {
    console.error("Error toggling subscription:", error);
    throw new ApiError(
      500,
      error.message ||
        "An unexpected error occurred while toggling subscription"
    );
  }
});

/-------controller to return subscriber list of a channel-----------------/;
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  // if (!channelId && req.user?._id) {

  //   channelId = req.user._id.toString();

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const channelUser = await User.findById(channelId);
  if (!channelUser) {
    throw new ApiError(404, "Channel (user) not found.");
  }

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
    const subscriberAggregate = Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriberDetails",
          pipeline: [
            {
              $project: {
                userName: 1,
                avatar: 1,
                fullName: 1,
                _id: 1,
              },
            },
          ],
        },
      },

      {
        $unwind: "$subscriberDetails",
      },
      {
        $replaceRoot: { newRoot: "$subscriberDetails" },
      },
    ]);

    const options = {
      page,
      limit,
      customLabels: {
        totalDocs: "totalSubscribers",
        docs: "subscribers",
      },
    };
    const result = await Subscription.aggregatePaginate(
      subscriberAggregate,
      options
    );
    if (
      !result ||
      typeof result !== "object" ||
      !result.subscribers ||
      !Array.isArray(result.subscribers)
    ) {
      console.error(
        "Subscription.aggregatePaginate returned an unexpected result structure for subscribers:",
        result
      );
      throw new ApiError(
        500,
        "Failed to fetch subscribers: invalid pagination result."
      );
    }

    if (result.subscribers.length === 0) {
      if (page > 1 && result.totalSubscribers > 0 && page > result.totalPages) {
        return res.status(200).json(
          new ApiResponse(
            200,

            { ...result, subscribers: [] }, // Ensure subscribers array is present
            "No subscribers found on this page."
          )
        );
      }
      return res.status(200).json(
        new ApiResponse(
          200,

          {
            subscribers: [],
            totalSubscribers: 0,
            currentPage: 1,
            limit: limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          "This channel has no subscribers yet."
        )
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Channel subscribers fetched successfully."
        )
      );
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    throw new ApiError(
      500,
      error.message || "An unexpected error occurred while fetching subscribers"
    );
  }
});

/-----controller to return channel list to which user has subscribed--------/;
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid User ID format for subscriber.");
  }

  const subscriberUser = await User.findById(userId);
  if (!subscriberUser) {
    throw new ApiError(404, "Subscriber not found");
  }

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
    const subscribedChannelAggregate = Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(userId),
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "channelDetails",
          pipeline: [
            {
              $project: {
                userName: 1,
                avatar: 1,
                fullName: 1,
                _id: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "channelDetails",
      },
      {
        $replaceRoot: { newRoot: "$channelDetails" },
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
        totalDocs: "totalSubscribedChannels",
        docs: "subscribedChannels",
      },
    };

    const result = await Subscription.aggregatePaginate(
      subscribedChannelAggregate,
      options
    );

    if (
      !result ||
      (result.docs.length === 0 && result.totalDocs === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscribedChannels: [],
            totalSubscribedChannels: result?.totalDocs || 0,
            currentPage: page,
            totalPages: result?.totalPages || 0,
            ...options,
          },
          "No subscribed channels found on this page."
        )
      );
    }
    if (!result || result.docs.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscribedChannels: [],
            totalSubscribedChannels: 0,
            currentPage: 1,
            totalPages: 0,
            ...options,
          },
          "this user has not subscribed to any channel yet."
        )
      );
    }
    const responseData = { ...result };
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          `Subscribed channels fetched successfully.`
        )
      );
  } catch (error) {
    console.error("Error fetching subscribed channels:", error);
    throw new ApiError(
      500,
      error.message ||
        "An unexpected error occurred while fetching subscribed channels"
    );
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
