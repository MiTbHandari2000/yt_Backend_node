import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const likeSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

likeSchema.pre("validate", function (next) {
  const contentFields = ["video", "comment", "tweet"];
  const providedCount = contentFields.reduce(
    (count, field) => count + (this[field] ? 1 : 0),
    0
  );
  if (providedCount !== 1) {
    next(
      new Error("Like must target exactly one item (video, comment, or tweet).")
    );
  } else {
    next();
  }
});

likeSchema.index(
  { video: 1, likedBy: 1 },
  {
    unique: true,
    partialFilterExpression: { video: { $type: "objectId" } }, // Only apply uniqueness if 'video' is an ObjectId
  }
);

likeSchema.index(
  { comment: 1, likedBy: 1 },
  {
    unique: true,
    partialFilterExpression: { comment: { $type: "objectId" } }, // Only apply uniqueness if 'comment' is an ObjectId
  }
);

likeSchema.index(
  { tweet: 1, likedBy: 1 },
  {
    unique: true,
    partialFilterExpression: { tweet: { $type: "objectId" } }, // Only apply uniqueness if 'tweet' is an ObjectId
  }
);

likeSchema.plugin(mongooseAggregatePaginate);
export const Like = mongoose.model("Like", likeSchema);
