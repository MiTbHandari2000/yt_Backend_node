import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-paginate-v2";

const VideoSchema = new Schema({
  videoFile: {
    type: String, //cloudinary url
    required: true,
  },
  thumbnail: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: Number, //cloudinary url
    required: true,
  },
  views: {
    type: String,
    default: 0,
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

VideoSchema.plugin(mongooseAggregatePaginate);
export const Video = mongoose.model("Video", VideoSchema);
