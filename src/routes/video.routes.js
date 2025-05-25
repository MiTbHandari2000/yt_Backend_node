import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  upload,
  uploadVideo,
  uploadGeneric,
} from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
  .route("/")
  .get(getAllVideos)
  .post(
    uploadGeneric.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    (req, res, next) => {
      // Temporary debugging middleware
      console.log(
        "IN ROUTE - AFTER MULTER - req.files:",
        JSON.stringify(req.files, null, 2)
      );
      console.log(
        "IN ROUTE - AFTER MULTER - req.body:",
        JSON.stringify(req.body, null, 2)
      );
      if (!req.files || !req.files.videoFile) {
        console.error(
          "IN ROUTE - Video file still not found after Multer in route!"
        );
      }
      next();
    },

    publishAVideo
  );

router
  .route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router;
