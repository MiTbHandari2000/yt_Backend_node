import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandaler.js";
import e, { response } from "express";

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

  if (channelId.tostring() === subscriberId.tostring()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const channelExists = await User.findById(channelId);
  if (!channelExists) {
    throw new ApiError(404, "Channel not found");
  }

  const subcriptionCondition = {
    channel: channelId,
    subscriber: subscriberId,
  };
  const existingSubcription = await Subscription.findOne(subcriptionCondition);

  let responseMessage = "";
  let statusCode = 200;
  let subscribed = false;
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
      subscribed = false;
      subscriptionData = { channelId, subscriberId, subscribed: false };
    } else {
      const newSubscription = await Subscription.create(subcriptionCondition);
      if (!newSubscription) {
        throw new ApiError(500, "Fail to subscribe the channel");
      }
      responseMessage = "Subscribed successfully";
      subscribed = true;
      statusCode = 201;
      subscriptionData = {
        channelId,
        subscriberId,
        subscribed: true,
        subscriberId: newSubscription._id,
      };
    }

    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, responseMessage, subscriptionData));
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

  if (!channelId && req.user?._id) {
    channelId = req.user._id.tostring();
  } else if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const channelUser = await User.findById(req.user._id);
  if (!channelUser) {
    throw new ApiError(404, "Channel not found");
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
    const subscriberAggregate = await Subscription.aggregate([
      {
        $match: {
          channel: mongoose.Types.ObjectId(channelId),
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
      (result.docs.length === 0 && result.totalDocs === 0 && page > 1)
    ) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscribers: [],
            totalSubscribers: result?.totalDocs || 0,
            currentPage: page,
            totalPages: result?.totalPages || 0,
            ...options,
          },
          "No subscribers found on this page."
        )
      );
    }
    if (!result || result.docs.length === 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            subscribers: [],
            totalSubscribers: 0,
            currentPage: 1,
            totalPages: 0,
            ...options,
          },
          "this channel has no subscribers yet."
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
          `Channel subscribers fetched successfully.`
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
    const subscribedChannelAggregate = await Subscription.aggregate([
      {
        $match: {
          subscriber: mongoose.Types.ObjectId(userId),
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
