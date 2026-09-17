/**
 * lib/asyncHandler.js
 * Express 4 doesn't automatically catch errors thrown inside an async
 * route handler — an unhandled rejection there just crashes the
 * function (on Vercel this shows up as a generic, unhelpful 500 with
 * no message). Wrapping every async handler with this forwards the
 * error to app.js's error-handling middleware instead, which returns
 * a proper JSON { error: "..." } response.
 */

module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
