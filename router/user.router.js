const express = require("express");
const router = express.Router();
const User = require("../schema/User.model");
const Joi = require("@hapi/joi");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const token_verification = require("../middleware/token_verification");

router.get("/", token_verification, async (req, res) => {
  const user = await User.findOne({
    username: req.username,
  });
  return res.status(200).json({
    username: req.username,
    wallet_address: req.wallet_address,
  });
});
router.post("/login", async (req, res) => {
  if (!req.body.username)
    return res.status(400).json({
      message: "username does not exist in the body",
    });
  if (!req.body.password)
    return res.status(400).json({
      message: "password does not exist in the body",
    });
  const { username, password } = req.body;
  try {
    const user = await User.findOne({
      username,
    });
    const validation = await bcrypt.compare(password, user.password);
    if (!validation)
      return res.status(401).json({
        message: "credentials does not match",
      });
    const token = jwt.sign(
      {
        username: user.username,
        wallet_address: user.wallet_address,
      },
      dotenv.parsed.JWT_SECRET
    );
    return res
      .cookie("Authorization", `Bearer ${token}`, { maxAge: 1800000 })
      .status(200)
      .json({
        message: "login successful",
      });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});
router.post("/register", async (req, res) => {
  if (!req.body.username)
    return res.status(400).json({
      message: "username does not exist in the body",
    });
  if (!req.body.password)
    return res.status(400).json({
      message: "password does not exist in the body",
    });
  if (!req.body.wallet_address)
    return res.status(400).json({
      message: "wallet address does not exist in the body",
    });
  const { username, password, wallet_address } = req.body;
  const schema = Joi.object({
    username: Joi.string().min(6).required(),
    password: Joi.string().min(6).required(),
    wallet_address: Joi.string().min(42).required(),
  });
  const { validation_error } = schema.validate(req.body);
  if (validation_error)
    return res.status(400).json({
      message: validation_error.details[0].message,
    });

  const salt = await bcrypt.genSalt(10);
  const hashed_password = await bcrypt.hash(password, salt);
  try {
    await User.create({
      username,
      password: hashed_password,
      wallet_address,
    });
    const token = jwt.sign(
      {
        username,
        wallet_address,
      },
      dotenv.parsed.JWT_SECRET
    );
    return res
      .cookie("Authorization", `Bearer ${token}`, { maxAge: 1800000 })
      .status(200)
      .json({
        message: "user has been created",
        data: [],
      });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
