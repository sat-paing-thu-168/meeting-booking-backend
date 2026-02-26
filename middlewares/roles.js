exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
};

exports.requireOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Owner access required" });
  }
  next();
};

exports.requireAdminOrOwner = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "owner") {
    return res.status(403).json({ error: "Admin or owner access required" });
  }
  next();
};

exports.requireSelfOrAdmin = (req, res, next) => {
  const { id } = req.params;
  if (req.user.role !== "admin" && req.user.id !== id) {
    return res
      .status(403)
      .json({ error: "Access denied. Can only view your own profile." });
  }
  next();
};
