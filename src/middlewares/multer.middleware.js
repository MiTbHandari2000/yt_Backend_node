import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    /--SPECIFIES THE FOLDER WHERE UPLOADED FILES WILL BE STORED---/;
    cb(null, "./public/temp");
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
    /----SPECIFIES THE NAME THE FILE WILL BE HAVE WHEN STORED----/;
  },
});

// Filter for IMAGES ONLY
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  const fileExt = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(fileExt)) {
    cb(null, true); // Accept file
  } else {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    err.message = `Unsupported file type: ${file.mimetype || fileExt}. Only images are allowed.`;
    cb(err, false);
  }
};

const limits = {
  fileSize: 1024 * 1024 * 5,
};

// Filter for VIDEOS ONLY
const videoFileFilter = (req, file, cb) => {
  const allowedMimes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-matroska",
    "video/webm",
  ]; // Add more video mimes
  const allowedExts = [".mp4", ".mpeg", ".mov", ".mkv", ".webm"]; // Add more video extensions
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(fileExt)) {
    cb(null, true);
  } else {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    err.message = `Unsupported file type for video: ${file.mimetype || fileExt}. Only common video formats are allowed.`;
    cb(err, false);
  }
};

const commonLimits = {
  fileSize: 1024 * 1024 * 50, // Example: 50MB limit, adjust for videos vs images
};

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: limits,
});

export const uploadVideo = multer({
  storage: storage,
  fileFilter: videoFileFilter, // Use video filter
  limits: { fileSize: 1024 * 1024 * 200 }, // 200MB for videos, adjust
});
export const uploadGeneric = multer({
  storage: storage,
});
