import { asyncHandler } from "../utils/asyncHandaler.js";

const registerUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "chai aur mit",
  });
});

export { registerUser };
