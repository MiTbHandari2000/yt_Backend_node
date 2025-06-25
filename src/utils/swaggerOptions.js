// src/config/swaggerOptions.js
const PORT = process.env.PORT || 8000;

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "VideoTube Backend API",
    version: "1.0.0",
    description: "Comprehensive REST API for the VideoTube platform.",
    license: { name: "ISC" },
    contact: {
      name: "Mit Bhandari / YT-backend",
      email: "meetbhandari786@gmail.com",
    },
  },
  servers: [{ url: `/api/v1`, description: "Development Server (v1)" }],
  tags: [
    {
      name: "User Authentication",
      description: "User registration, login, token management.",
    },
    {
      name: "User Account",
      description: "User profile and account management.",
    },
    {
      name: "Videos",
      description: "Video CRUD, listing, and status management.",
    },
    { name: "Comments", description: "Managing comments on videos." },
    {
      name: "Likes",
      description: "Managing likes on videos, comments, and tweets.",
    },
    { name: "Subscriptions", description: "Managing channel subscriptions." },
    { name: "Playlists", description: "Managing user video playlists." },
    { name: "Tweets", description: "Managing user tweets." },
    {
      name: "Dashboard",
      description: "User-specific channel statistics and content.",
    },
    { name: "Healthcheck", description: "API health status." },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT: Bearer <YOUR_TOKEN>",
      },
    },
    // ---------- SCHEMAS ----------
    schemas: {
      // --- Generic ---
      ErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error message." },
          errors: {
            type: "array",
            items: { type: "string" },
            example: [],
            nullable: true,
          },
        },
      },
      SuccessResponseDataGeneric: {
        type: "object",
        example: {},
        description: "Empty data or simple confirmation.",
      },
      ObjectId: {
        type: "string",
        format: "objectid",
        example: "60c72b2f9b1d8e001c8e4c6a",
      },

      // --- User ---
      UserBase: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          userName: { type: "string" },
          fullName: { type: "string" },
          avatar: { type: "string", format: "url" },
        },
      },
      UserResponseData: {
        allOf: [
          { $ref: "#/components/schemas/UserBase" },
          {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              coverImage: { type: "string", format: "url", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      LoginRequest: {
        type: "object",
        required: ["password"],
        properties: {
          email: { type: "string", format: "email", nullable: true },

          password: { type: "string", format: "password" },
        },
      },
      LoginSuccessData: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/UserResponseData" },
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      RefreshTokenSuccessData: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      PasswordChangeRequest: {
        type: "object",
        required: ["oldPassword", "newPassword"],
        properties: {
          oldPassword: { type: "string", format: "password" },
          newPassword: { type: "string", format: "password", minLength: 6 },
        },
      },
      AccountUpdateRequest: {
        type: "object",
        properties: {
          fullName: { type: "string", nullable: true },
          email: { type: "string", format: "email", nullable: true },
        },
      },
      UserChannelProfileData: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          userName: { type: "string" },
          fullName: { type: "string" },
          avatar: { type: "string", format: "url" },
          coverImage: { type: "string", format: "url", nullable: true },
          subscribersCount: { type: "integer" },
          channelsSubscribedToCount: { type: "integer" },
          isSubscribed: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      WatchHistoryVideoData: {
        allOf: [{ $ref: "#/components/schemas/VideoResponse" }],
      }, // A watched video is a video
      PaginatedWatchHistoryData: {
        type: "object",
        properties: {
          docs: {
            type: "array",
            items: { $ref: "#/components/schemas/WatchHistoryVideoData" },
          },
          totalDocs: { type: "integer" },
          limit: { type: "integer" },
          page: { type: "integer" },
          totalPages: { type: "integer" },
          hasNextPage: { type: "boolean" },
          hasPrevPage: { type: "boolean" },
        },
      },

      // --- Video ---
      VideoResponse: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          videoFile: { type: "string", format: "url" },
          thumbnail: { type: "string", format: "url" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          duration: { type: "number" },
          views: { type: "integer" },
          isPublished: { type: "boolean" },
          owner: { $ref: "#/components/schemas/UserBase" },
          videoFilePublicId: { type: "string", nullable: true },
          thumbnailPublicId: { type: "string", nullable: true },
          videoFileResourceType: { type: "string", nullable: true },
          thumbnailResourceType: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PublishVideoFormData: {
        type: "object",
        required: [
          "title",
          "description",
          "duration",
          "videoFile",
          "thumbnail",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          duration: { type: "number" },
          videoFile: { type: "string", format: "binary" },
          thumbnail: { type: "string", format: "binary" },
        },
      },
      UpdateVideoTextRequest: {
        type: "object",
        properties: {
          title: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
        },
      },
      UpdateVideoThumbnailFormData: {
        type: "object",
        required: ["thumbnail"],
        properties: { thumbnail: { type: "string", format: "binary" } },
      },
      TogglePublishResponseData: {
        type: "object",
        properties: {
          videoId: { $ref: "#/components/schemas/ObjectId" },
          isPublished: { type: "boolean" },
        },
      },
      DeleteResponseData: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          message: { type: "string" },
        },
      }, // Generic delete response
      PaginatedVideosData: {
        type: "object",
        properties: {
          videos: {
            type: "array",
            items: { $ref: "#/components/schemas/VideoResponse" },
          },
          totalVideos: { type: "integer" } /* +pagination fields */,
        },
      },

      // --- Comment ---
      CommentResponseData: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          content: { type: "string" },
          video: { $ref: "#/components/schemas/ObjectId" },
          owner: { $ref: "#/components/schemas/UserBase" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateCommentRequest: {
        type: "object",
        required: ["content"],
        properties: { content: { type: "string" } },
      },
      UpdateCommentRequest: {
        $ref: "#/components/schemas/CreateCommentRequest",
      }, // Same as create
      PaginatedCommentsData: {
        type: "object",
        properties: {
          comments: {
            type: "array",
            items: { $ref: "#/components/schemas/CommentResponseData" },
          },
          totalComments: { type: "integer" } /* +pagination */,
        },
      },

      // --- Like ---
      ToggleLikeResponseData: {
        type: "object",
        properties: {
          liked: { type: "boolean" },
          likeId: { $ref: "#/components/schemas/ObjectId", nullable: true },
          videoId: { $ref: "#/components/schemas/ObjectId", nullable: true },
          commentId: { $ref: "#/components/schemas/ObjectId", nullable: true },
          tweetId: { $ref: "#/components/schemas/ObjectId", nullable: true },
          likedBy: { $ref: "#/components/schemas/ObjectId" },
        },
      },
      PaginatedLikedVideosData: {
        $ref: "#/components/schemas/PaginatedVideosData",
      },

      // --- Subscription ---
      ToggleSubscriptionResponseData: {
        type: "object",
        properties: {
          channelId: { $ref: "#/components/schemas/ObjectId" },
          subscriberId: { $ref: "#/components/schemas/ObjectId" },
          subscribed: { type: "boolean" },
          subscriptionId: {
            $ref: "#/components/schemas/ObjectId",
            nullable: true,
          },
        },
      },
      PaginatedSubscribersData: {
        type: "object",
        properties: {
          subscribers: {
            type: "array",
            items: { $ref: "#/components/schemas/UserBase" },
          },
          totalSubscribers: { type: "integer" } /* +pagination */,
        },
      },
      PaginatedSubscribedChannelsData: {
        type: "object",
        properties: {
          subscribedChannels: {
            type: "array",
            items: { $ref: "#/components/schemas/UserBase" },
          },
          totalSubscribedChannels: { type: "integer" } /* +pagination */,
        },
      },

      // --- Playlist ---
      PlaylistResponseData: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          owner: { $ref: "#/components/schemas/UserBase" },
          videos: {
            type: "array",
            items: { $ref: "#/components/schemas/ObjectId" },
          },
          videoCount: { type: "integer" },
          previewThumbnails: {
            type: "array",
            items: { type: "string", format: "url" },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreatePlaylistRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string", nullable: true },
        },
      },
      UpdatePlaylistRequest: {
        $ref: "#/components/schemas/CreatePlaylistRequest",
      }, // Can be same if fields are optional in update
      PlaylistWithPaginatedVideosData: {
        type: "object",
        properties: {
          /* playlist fields like PlaylistResponseData but without videos array of IDs */ _id: {
            $ref: "#/components/schemas/ObjectId",
          },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          owner: { $ref: "#/components/schemas/UserBase" },
          videos: {
            type: "array",
            items: { $ref: "#/components/schemas/VideoResponse" },
          },
          paginationForVideos: {
            type: "object",
            properties: {
              totalVideos: {
                type: "integer",
              } /* ...other video pagination fields...*/,
            },
          },
        },
      },
      PaginatedPlaylistsData: {
        type: "object",
        properties: {
          playlists: {
            type: "array",
            items: { $ref: "#/components/schemas/PlaylistResponseData" },
          },
          totalPlaylists: { type: "integer" } /* +pagination */,
        },
      },

      // --- Tweet ---
      TweetResponseData: {
        type: "object",
        properties: {
          _id: { $ref: "#/components/schemas/ObjectId" },
          content: { type: "string", maxLength: 280 },
          owner: { $ref: "#/components/schemas/UserBase" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateTweetRequest: {
        type: "object",
        required: ["content"],
        properties: { content: { type: "string", maxLength: 280 } },
      },
      UpdateTweetRequest: { $ref: "#/components/schemas/CreateTweetRequest" },
      PaginatedTweetsData: {
        type: "object",
        properties: {
          tweets: {
            type: "array",
            items: { $ref: "#/components/schemas/TweetResponseData" },
          },
          totalTweets: { type: "integer" } /* +pagination */,
        },
      },

      // --- Dashboard ---
      ChannelStatsResponseData: {
        type: "object",
        properties: {
          totalVideos: { type: "integer" },
          totalSubscribers: { type: "integer" },
          totalViews: { type: "integer" },
          totalLikes: { type: "integer" },
          channelId: { $ref: "#/components/schemas/ObjectId" },
        },
      },
      PaginatedDashboardVideosData: {
        $ref: "#/components/schemas/PaginatedVideosData",
      }, // Reuses videos structure

      // --- Healthcheck ---
      HealthcheckResponseData: {
        type: "object",
        properties: {
          status: { type: "string", example: "OK" },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "number" },
        },
      },

      // --- Standard API Response Wrappers (Data part is specific schema) ---
      ApiResponse_UserResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/UserResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_LoginSuccessData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/LoginSuccessData" },
          message: { type: "string" },
        },
      },
      ApiResponse_RefreshTokenSuccessData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/RefreshTokenSuccessData" },
          message: { type: "string" },
        },
      },
      ApiResponse_SuccessResponseGenericData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/SuccessResponseGenericData" },
          message: { type: "string" },
        },
      },
      ApiResponse_UserChannelProfileData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/UserChannelProfileData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedWatchHistoryData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedWatchHistoryData" },
          message: { type: "string" },
        },
      },
      ApiResponse_VideoResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/VideoResponse" },
          message: { type: "string" },
        },
      }, // For single video
      ApiResponse_TogglePublishResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/TogglePublishResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_DeleteResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/DeleteResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedVideosData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedVideosData" },
          message: { type: "string" },
        },
      },
      ApiResponse_CommentResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/CommentResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedCommentsData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedCommentsData" },
          message: { type: "string" },
        },
      },
      ApiResponse_DeleteCommentResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/DeleteCommentResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_ToggleLikeResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/ToggleLikeResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedLikedVideosData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedLikedVideosData" },
          message: { type: "string" },
        },
      },
      ApiResponse_ToggleSubscriptionResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/ToggleSubscriptionResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedSubscribersData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedSubscribersData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedSubscribedChannelsData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: {
            $ref: "#/components/schemas/PaginatedSubscribedChannelsData",
          },
          message: { type: "string" },
        },
      },
      ApiResponse_PlaylistResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PlaylistResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PlaylistWithPaginatedVideosData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: {
            $ref: "#/components/schemas/PlaylistWithPaginatedVideosData",
          },
          message: { type: "string" },
        },
      },
      ApiResponse_DeletePlaylistResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/DeletePlaylistResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedPlaylistsData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedPlaylistsData" },
          message: { type: "string" },
        },
      },
      ApiResponse_TweetResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/TweetResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_DeleteTweetResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/DeleteTweetResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_PaginatedTweetsData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/PaginatedTweetsData" },
          message: { type: "string" },
        },
      },
      ApiResponse_ChannelStatsResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/ChannelStatsResponseData" },
          message: { type: "string" },
        },
      },
      ApiResponse_HealthcheckResponseData: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          statusCode: { type: "integer" },
          data: { $ref: "#/components/schemas/HealthcheckResponseData" },
          message: { type: "string" },
        },
      },
    },
    responses: {
      BadRequestError: {
        description: "Bad Request. Invalid input or missing parameters.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      UnauthorizedError: {
        description:
          "Unauthorized. Authentication credentials are required or invalid.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ForbiddenError: {
        description: "Forbidden. Insufficient permissions.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFoundError: {
        description: "Not Found. Resource not found.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ConflictError: {
        description:
          "Conflict. Resource already exists or operation conflicts.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      InternalServerError: {
        description: "Internal Server Error.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      SuccessGeneric: {
        description: "Operation successful.",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ApiResponse_SuccessResponseGenericData",
            },
          },
        },
      },
    },
    parameters: {
      PageQueryParam: {
        name: "page",
        in: "query",
        description: "Page number for pagination.",
        schema: { type: "integer", default: 1 },
      },
      LimitQueryParam: {
        name: "limit",
        in: "query",
        description: "Number of items per page.",
        schema: { type: "integer", default: 10 },
      },
      VideoIdPath: {
        name: "videoId",
        in: "path",
        required: true,
        description: "The ID of the video.",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      CommentIdPath: {
        name: "commentId",
        in: "path",
        required: true,
        description: "The ID of the comment.",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      TweetIdPath: {
        name: "tweetId",
        in: "path",
        required: true,
        description: "The ID of the tweet.",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      PlaylistIdPath: {
        name: "playlistId",
        in: "path",
        required: true,
        description: "The ID of the playlist.",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      UserIdPath: {
        name: "userId",
        in: "path",
        required: true,
        description: "The ID of the user.",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      ChannelIdPath: {
        name: "channelId",
        in: "path",
        required: true,
        description: "The ID of the channel (user).",
        schema: { $ref: "#/components/schemas/ObjectId" },
      },
      UserNamePath: {
        name: "userName",
        in: "path",
        required: true,
        description: "The username of the user/channel.",
        schema: { type: "string" },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [
    // Update this list to point to your .yaml files in src/docs/
    "./src/docs/user.docs.yaml",
    "./src/docs/video.docs.yaml",
    "./src/docs/comment.docs.yaml",
    "./src/docs/like.docs.yaml",
    "./src/docs/playlist.docs.yaml",
    "./src/docs/subscription.docs.yaml",
    "./src/docs/tweet.docs.yaml",
    "./src/docs/dashboard.docs.yaml",
    "./src/docs/healthcheck.docs.yaml",
  ],
};

export default options;
