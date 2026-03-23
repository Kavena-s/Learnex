module.exports = (req, res, next) => {
  if (req.user.role !== "faculty" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Faculty only" });
  }
  next();
};
