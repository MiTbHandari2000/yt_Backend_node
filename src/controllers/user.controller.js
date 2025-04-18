import { asyncHandler } from "../utils/asyncHandaler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
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

const registerUser = asyncHandler(async (req, res) => {
  ///get user details from front-end
  //validation-not empty
  //check if user already exits : username-email
  //check for images - avatar-coverImage
  //upload them to cloudinary-avatar-coverImg
  //create user object-entry in DB
  //remove password adn refresh from response
  //check for user creation
  //return response

  const { fullName, userName, email, password } = req.body || {};
  //console.log("email:", email);
  //console.log(req.body);

  if (
    [fullName, email, userName, password].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "all fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "user with email or username exists");
  }
  //console.log(req.files);

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

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registerd successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //TODO's
  //1.req body = data -> get data from user
  //2.username or email
  //3.find the user -> user is registered or not
  //4.password check -> given password is right or not
  //5.Access & refresh token -> generate both tokens
  //6.send cookies ->
  //7.send response

  const { email, userName, password } = req.body;
  //1.get data from user
  if (!userName || !email) {
    throw new ApiError(400, "username or email required");
  }
  ///2.username or email
  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });
  //3.find user
  if (!user) {
    throw new ApiError(404, "USER NOT FOUND");
  }
  //4.password correct?
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid user credentials");
  }

  //5.ACCESS AND REFRESH TOKEN GENERATION

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  //6.send to cooklies

  //DIDNT GET IT THIS PART
  const loggedInUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

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
  const logOutUser = asyncHandler(async (req, res) => {
    //todo's
    //clear cookies /
    //refresh token reset

    User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
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

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "USer logged out"));
  });
});

export { registerUser, loginUser, logOutUser };
