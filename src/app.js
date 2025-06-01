import express from "express";
import { ApiError } from "./utils/ApiError.js";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

/-------Enable CORS-------/;
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

/-PARSE JSON PAYLOAD-/;
app.use(express.json({ limit: "16kb" }));

/---PARSE URL-ENCODED PAYLOAD--/;
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

/-SERVES STATIC FILE FROM PUBLIC DIRECTORY-/;
app.use(express.static("public"));

/-PARSE COOKIES_ ALLOWS EASY ACCESS TO COOKIES FOR AUTH,TARCKING-/;
app.use(cookieParser());

/-IMPORT ROUTES FROM ROUTER.JS FILE -/;

import userRouter from "./routes/user.routes.js";
// import healthcheckRouter from "./routes/healthcheck.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

/-ROUTE DECLARATION-/;

// app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlists", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let success = false;
  let errors = err.errors || []; // For multiple validation errors
  let stack = err.stack;

  if (err instanceof ApiError) {
    // Make sure ApiError is imported if not already
    statusCode = err.statusCode;
    message = err.message;
    success = err.success; // Should be false from ApiError
    errors = err.errors;
  } else {
    console.error("UNHANDLED ERROR:", err);

    if (process.env.NODE_ENV === "production") {
      message = "An unexpected internal server error occurred.";
      stack = null; // Don't send stack trace in production for non-ApiErrors
    }
  }

  res.status(statusCode).json({
    success,
    message,
    errors,
    stack: process.env.NODE_ENV === "development" ? stack : undefined,
  });
});

export { app };
