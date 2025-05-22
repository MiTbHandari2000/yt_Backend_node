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

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: limits,
});
