import { asyncHandler } from "../utils/asyncHandaler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { error, log } from "console";
import jwt from "jsonwebtoken";

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

export { registerUser, loginUser, logoutUser, refreshAccessToken };
