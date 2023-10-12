const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();

module.exports = (req, res, next) => {
  try {
    const cookies = req.cookies;
    if (!cookies["Authorization"])
      return res.status(401).json({ message: "authorization does not exist" });
    const authorization = cookies["Authorization"].split(" ");
    if (authorization[0] !== "Bearer")
      return res.status(401).json({
        message: "use the agreed authorization system",
      });
    const token = authorization[1];
    if (!token)
      return res.status(401).json({
        message: "no exist token",
      });
    const verified = jwt.verify(token, dotenv.parsed.JWT_SECRET);
    if (!verified)
      return res.status(401).json({
        message: "jwt token is not verified",
      });
    const { username, wallet_address } = jwt.decode(
      token,
      dotenv.parsed.JWT_SECRET
    );
    req.username = username;
    req.wallet_address = wallet_address;
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
  next();
};
