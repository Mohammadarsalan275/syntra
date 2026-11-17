import jwt from "jsonwebtoken";


export function authUser(req, res, next) {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearerToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required",
    });
  }

  const demoMode =
    process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false";
  const secret =
    process.env.JWT_SECRET ||
    process.env.jwt_secret ||
    (demoMode
      ? "nexora-local-development-only-secret"
      : null);
  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
  }

  try {
    req.user = jwt.verify(token, secret);
    if (req.user.demo && !demoMode) {
      return res.status(401).json({
        success: false,
        message: "Demo authentication is disabled.",
      });
    }
    req.user._id = req.user._id || req.user.id;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}