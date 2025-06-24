import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

/----------USER.REGISTER ROUTE -------/;

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

/------------USER.LOGIN ROUTE--------/;

router.route("/login").post(loginUser);

//SECURED ROUTES/

/-----------------REFRESH-TOKENS---------------------/;

router.route("/refresh-token").post(refreshAccessToken);

// --- APPLY verifyJWT FOR ALL SUBSEQUENT ROUTES ---
router.use(verifyJWT);

/------------USER.LOGOUT ROUTE--------------------/;

router.route("/logout").post(logoutUser);

router.route("/change-password").post(changeCurrentPassword);

router.route("/current-user").get(getCurrentUser);

router.route("/update-account").patch(updateAccountDetails);

router.route("/avatar").patch(upload.single("avatar"), updateUserAvatar);

router
  .route("/cover-image")
  .patch(upload.single("coverImage"), updateUserCoverImage);

router.route("/c/:userName").get(getUserChannelProfile);

router.route("/history").get(getWatchHistory);

export default router;
