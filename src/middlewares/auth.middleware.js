import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    /.-------EXTRACTING THE TOKEN FROM COOKIES OR HEADER---------/;

    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    /---CHECK IF TOKEN EXISTS OR NOT ---/;
    if (!token) {
      throw new ApiError(401, "unauthorized request");
    }

    /-----DECODETOKEN HOLDS PAYLOAD OF JWT AFTER IT HAS BEEN VERIFIED----/;

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log(decodedToken);

    /--------FINDS THE USER IN DATABASE-------/;

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    /-ATTACHES THE AUTHENTICATED USER'S INFORMATION TO THE "req" OBJECT-/;

    req.user = user; //did'nt get it

    /-----TELLS THE EXPRESS TO THE NEXT STEP------/;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});
