import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    /--SPECIFIES THE FOLDER WHERE UPLOADED FILES WILL BE STORED---/;
    cb(null, "./public/temp");
  },

  filename: function (req, file, cb) {
    cb(null, file.originalname);
    /----SPECIFIES THE NAME THE FILE WILL BE HAVE WHEN STORED----/;
  },
});

export const upload = multer({
  storage,
});
