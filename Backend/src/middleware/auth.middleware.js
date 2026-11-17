import jwt from "jsonwebtoken";

export function getJwtSecret() {
  const demoMode =
    process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false";
  return (
    process.env.JWT_SECRET ||
    process.env.jwt_secret ||
    (demoMode ? "nexora-local-development-only-secret" : null)
  );
}

function isDemoModeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false";
}

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

  const demoMode = isDemoModeEnabled();
  const secret = getJwtSecret();
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

export function authChatUser(req, res, next) {
  const guestSession = req.get("x-guest-session");
  if (!guestSession) return authUser(req, res, next);

  if (!isDemoModeEnabled()) {
    return res.status(401).json({
      success: false,
      message: "Guest chat sessions are disabled.",
    });
  }

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
  }

  try {
    const guest = jwt.verify(guestSession, secret);
    if (guest.guestSession !== true || typeof guest.guestId !== "string") {
      return res.status(401).json({
        success: false,
        message: "Invalid guest chat session",
      });
    }

    req.user = { _id: guest.guestId, demo: true, guestSession: true };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired guest chat session",
    });
  }
}