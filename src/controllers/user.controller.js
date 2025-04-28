import { asyncHandler } from "../utils/asyncHandaler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { error, log } from "console";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

/------------------------GENERATE TOKENS------------------------------/;
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "USer not Found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken; //i DONT get it
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and access Token"
    );
  }
};

/-----------------------Register-User-----------------------------/;

const registerUser = asyncHandler(async (req, res) => {
  /-1.get user details from front-end-/;
  /-2.validation-not empty-/;
  /-3.check if user already exits : username-email-/;
  /-4.check for images - avatar-coverImage-/;
  /-5.upload them to cloudinary-avatar-coverImg-/;
  /-6.create user object-entry in DB-/;
  /-7.remove password adn refresh from response-/;
  /-8.check for user creation-/;
  /-9.return response-/;

  /STEP-1 GET DATA FROM FRONT-END /;

  const { fullName, userName, email, password } = req.body || {};
  //console.log("email:", email);
  //console.log(req.body);

  /STEP-2 VALIDATE DATA FOR EMPTY STRING/;

  if (
    [fullName, email, userName, password].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "all fields are required");
  }

  /STEP-3 USER ALREADY EXITS/;

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with email or username exists");
  }
  //console.log(req.files);

  /STEP-4 CHECK AVATAR AND COVERIMAGE IS COMING /;

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is required");
  }

  /STEP-5 UPLOAD IMAGES TO CLOUDINARY /;

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "avatar is required");
  }

  /STEP-6 CREATE USER ENTRY IN DATABASE/;

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });

  /STEP-7 REMOVE PASSWORD AND REFRESH TOKEN FROM USER-RESPONSE /;

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  /STEP-8 CHECK FOR USER CREATION /;

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user");
  }

  /STEP-9 SEND RESPONSE TO FRONT-END/;

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registerd successfully"));
});

/----------------------------LOGIN---------------------------------/;
const loginUser = asyncHandler(async (req, res) => {
  /-----TODO's------/;

  /1.req body = data -> get data from user/;
  /2.username or email/;
  /3.find the user -> user is registered or not/;
  /4.password check -> given password is right or not/;
  /5.Access & refresh token -> generate both tokens/;
  /6.send cookies ->/;
  /7.send response/;

  /---1.GET DATA FROM USER.BODY---/;

  const { email, userName, password } = req.body;
  //console.log(email);

  /---CHECK THE USERNAME OR EMAIL IS EMPTY OR NOT--/;

  if (!userName && !email) {
    throw new ApiError(400, "username or email required");
  }

  /---3.FINDING THE USER BASED ON EITHER USERNAME OR EMAIL---/;

  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "USER NOT FOUND");
  }

  /----4. PASSWORD VALIDATION ---/;

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid user credentials password");
  }

  /----5.ACCESS AND REFRESH TOKEN GENERATION----/;

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  /-FETCHING USER'S DATA FROM DATABASE WHILE EXCLUDING PASSWORD & REFRESH TOKEN-/;

  //DIDNT GET IT THIS PART
  const loggedInUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );

  /-SETTING UP THE COOKIES IN USER'S BROWSER-/;

  const options = {
    httpOnly: true,
    secure: true,
    //sameSite: "strict",
  };

  /-(6&7).SEND'S COOKIES FOR CLIENT AND A JSON RESPONSE -/;

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "USER LOGGED IN SUCCESSFULLY"
      )
    );
});

/----------------------------------LOGOUT USER--------------------------------/;

const logoutUser = asyncHandler(async (req, res) => {
  //todo's
  /-1.clear cookies/;
  /-2.refresh token reset/;

  /-REMOVE THE REFRESH TOKEN FROM USER -/;

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  /-CLEAR COOKIES FROM CLIENT SIDE -/;

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "USer logged out"));
});

/---------------------refreshingAccessToken-----------------------/;

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "UnAthorized Request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh TOken");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used ");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken },
          { newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    new ApiError(401, error?.message || "invalid refresh token");
  }
});

/----------------change PASSWORD-----------/;

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfullys"));
});

/---------------------------get current user ------------------/;

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

/------------------------update account access -------------/;

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

/------------------------------------------update files ----------/;

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

/--------------------update coverImage -----------------------------/;

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverImage = uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on coverImage");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

/--------------------------GET USER CHANNEL PROFILE------------------/;

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params;

  if (!userName) {
    throw new ApiError(400, "username is missing");
  }
  const channel = await User.aggregate([
    {
      $match: {
        userName: userName?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscriberedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscriberedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        email: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);
  console.log(channel);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User Channel fetched successfully")
    );
});

/-------------------------GET WATCH HISTORY-----------------/;

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "watch History fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
