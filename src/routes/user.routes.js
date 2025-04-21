import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
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

/------------USER.LOGOUT ROUTE--------------------/;

router.route("/logout").post(verifyJWT, logoutUser);

export default router;
