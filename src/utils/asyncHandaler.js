/-ACCEPT THE ROUTE HANDLER -/;
const asyncHandler = (requestHandler) => {
  /-RETURN A NEW FUNCTION -/;
  return (req, res, next) => {
    /-HANDLE THE PROMISE-/;
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
