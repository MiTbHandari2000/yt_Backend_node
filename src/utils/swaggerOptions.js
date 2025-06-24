const PORT = process.env.PORT || 8000; // Assuming your default port

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "VideoTube Backend API",
    version: "1.0.0",
    description:
      "This is the REST API for the VideoTube backend platform, focusing on user and video management. " +
      "Further modules include comments, likes, subscriptions, playlists, and dashboards.",
    license: {
      name: "ISC",
    },
    contact: {
      name: "Mit Bhandari / YT-backend",
      email: "meetbhandari786@gmail.com",
    },
  },
  servers: [
    {
      url: `http://localhost:${PORT}/api/v1`, // Use the determined PORT
      description: "Development Server (v1)",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        // Used for JWT authentication
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Enter JWT Bearer token in the format: Bearer <YOUR_TOKEN>",
      },
    },
    schemas: {
      // --- GENERIC SCHEMAS ---
      ErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: false },
          message: {
            type: "string",
            example: "Error message describing the issue.",
          },
          errors: {
            type: "array",
            items: { type: "string" },
            example: [],
            description: "Optional array of specific error details.",
          },
          // Stack trace is typically not included in API responses for clients
        },
      },
      SuccessResponse_Generic: {
        // For simple success messages with no specific data
        type: "object",
        required: ["success", "statusCode", "message"],
        properties: {
          success: { type: "boolean", example: true },
          statusCode: { type: "integer", example: 200 },
          data: {
            type: "object",
            example: {},
            description: "Empty data object or simple confirmation.",
          },
          message: { type: "string", example: "Operation successful." },
        },
      },

      // --- USER RELATED SCHEMAS ---
      UserBase: {
        // Core user fields, used for embedding or basic profiles
        type: "object",
        properties: {
          _id: {
            type: "string",
            format: "objectid",
            example: "60c72b2f9b1d8e001c8e4c6a",
          },
          userName: { type: "string", example: "testuser123" },
          fullName: { type: "string", example: "Test User" },
          avatar: {
            type: "string",
            format: "url",
            example:
              "http://res.cloudinary.com/cloudname/image/upload/avatar.jpg",
          },
        },
      },
      UserResponse: {
        // Full User object returned by API (excluding sensitive info)
        allOf: [
          // Inherits from UserBase
          { $ref: "#/components/schemas/UserBase" },
          {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email",
                example: "test@example.com",
              },
              coverImage: {
                type: "string",
                format: "url",
                nullable: true,
                example:
                  "http://res.cloudinary.com/cloudname/image/upload/cover.jpg",
              },
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
          email: {
            type: "string",
            format: "email",
            nullable: true,
            description: "User's email (required if username not provided).",
            example: "test@example.com",
          },
          userName: {
            type: "string",
            nullable: true,
            description: "User's username (required if email not provided).",
            example: "testuser123",
          },
          password: {
            type: "string",
            format: "password",
            example: "Password123",
          },
        },
      },
      LoginSuccessResponseData: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/UserResponse" },
          accessToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
        },
      },
      PasswordChangeRequest: {
        type: "object",
        required: ["oldPassword", "newPassword"],
        properties: {
          oldPassword: {
            type: "string",
            format: "password",
            example: "CurrentP@ss1",
          },
          newPassword: {
            type: "string",
            format: "password",
            minLength: 6,
            example: "NewStr0ngP@ss",
          },
        },
      },
      AccountUpdateRequest: {
        type: "object",
        description:
          "At least one field (fullName or email) must be provided for update.",
        properties: {
          fullName: {
            type: "string",
            nullable: true,
            example: "Test User Updated",
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
            example: "test.updated@example.com",
          },
        },
      },
      UserChannelProfileResponseData: {
        // For GET /users/c/:userName
        type: "object",
        properties: {
          _id: { type: "string", format: "objectid" },
          userName: { type: "string" },
          fullName: { type: "string" },
          avatar: { type: "string", format: "url" },
          coverImage: { type: "string", format: "url", nullable: true },
          subscribersCount: { type: "integer", example: 0 },
          channelsSubscribedToCount: { type: "integer", example: 0 },
          isSubscribed: {
            type: "boolean",
            description:
              "True if the authenticated requester is subscribed to this channel.",
          },
        },
      },
      PaginatedWatchHistoryResponseData: {
        /* Define when watch history is fleshed out */
      },

      // --- VIDEO RELATED SCHEMAS ---
      VideoResponse: {
        // Video object returned by API
        type: "object",
        properties: {
          _id: { type: "string", format: "objectid" },
          videoFile: { type: "string", format: "url" },
          thumbnail: { type: "string", format: "url" },
          title: { type: "string" },
          description: { type: "string" },
          duration: { type: "number", description: "In seconds" },
          views: { type: "integer" },
          isPublished: { type: "boolean" },
          owner: { $ref: "#/components/schemas/UserBase" }, // Use UserBase for embedded owner
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PublishVideoFormData: {
        // For multipart/form-data when POST /videos
        type: "object",
        required: [
          "title",
          "description",
          "duration",
          "videoFile",
          "thumbnail",
        ],
        properties: {
          title: { type: "string", example: "My New Video Title" },
          description: {
            type: "string",
            example: "Description of my new video.",
          },
          duration: {
            type: "number",
            example: 180,
            description: "Video duration in seconds.",
          },
          videoFile: {
            type: "string",
            format: "binary",
            description: "The video file itself.",
          },
          thumbnail: {
            type: "string",
            format: "binary",
            description: "The thumbnail image for the video.",
          },
        },
      },
      UpdateVideoTextRequest: {
        // For PATCH /videos/:videoId with JSON body
        type: "object",
        description:
          "Update video title or description. At least one field required.",
        properties: {
          title: {
            type: "string",
            nullable: true,
            example: "Updated Video Title",
          },
          description: {
            type: "string",
            nullable: true,
            example: "Updated video description.",
          },
        },
      },
      UpdateVideoThumbnailFormData: {
        // For PATCH /videos/:videoId with multipart for thumbnail
        type: "object",
        required: ["thumbnail"], // Thumbnail is required for this specific operation type
        properties: {
          thumbnail: {
            type: "string",
            format: "binary",
            description: "The new thumbnail file.",
          },
        },
      },
      TogglePublishResponseData: {
        type: "object",
        properties: {
          videoId: { type: "string", format: "objectid" },
          isPublished: { type: "boolean" },
        },
      },
      PaginatedVideosResponseData: {
        // The 'data' part of paginated video list response
        type: "object",
        properties: {
          videos: {
            type: "array",
            items: { $ref: "#/components/schemas/VideoResponse" },
          },
          totalVideos: { type: "integer" },
          limit: { type: "integer" },
          page: { type: "integer" },
          totalPages: { type: "integer" },
          hasNextPage: { type: "boolean" },
          hasPrevPage: { type: "boolean" },
          // Add nextPage, prevPage if your API returns them
        },
      },

      // --- PLACEHOLDERS for other modules ---
      // Comment: { /* ... */ },
      // CreateCommentRequest: { /* ... */ },
      // PaginatedComments: { /* ... */ },
      // LikeResponseData: { /* ... based on your toggleLike data output ... */ },
      // Playlist: { /* ... */ },
      // CreatePlaylistRequest: { /* ... */ },
      // PaginatedPlaylists: { /* ... */ },
      // SubscriptionResponseData: { /* ... */ },
      // PaginatedSubscriptions: { /* ... */ },
      // Tweet: { /* ... */ },
      // CreateTweetRequest: { /* ... */ },
      // PaginatedTweets: { /* ... */ },
      // DashboardStatsResponseData: { /* ... */ }
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [
    "./src/docs/user-auth.docs.yaml",
    "./src/docs/video.docs.yaml",
    "./src/docs/comment.docs.yaml",
    "./src/docs/like.docs.yaml",
    "./src/docs/playlist.docs.yaml",
    "./src/docs/subscription.docs.yaml",
    "./src/docs/tweet.docs.yaml",
    "./src/docs/dashboard.docs.yaml",
    "./src/docs/healthCheck.docs.yaml",
  ],
};

export default options;
