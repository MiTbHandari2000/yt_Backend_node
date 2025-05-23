import mongoose, { Schema, Types } from "mongoose";
import mongooseAggregatePaginate from "mongoose-paginate-v2";

const commnetSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

commnetSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commnetSchema);
