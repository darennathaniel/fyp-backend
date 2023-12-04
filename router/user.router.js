const express = require("express");
const router = express.Router();
const User = require("../schema/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const token_verification = require("../middleware/token_verification");

const { Web3 } = require("web3");
const supplyChainNetwork = require("../SupplyChainNetwork.json");
const productContract = require("../ProductContract.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const sc_contract = new web3.eth.Contract(
  supplyChainNetwork.abi,
  supplyChainNetwork.networks[5777].address
);

router.get("/", token_verification, async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.username,
    });
    return res.status(200).json({
      message: "user obtained",
      data: [
        {
          username: user.username,
          company_name: user.display_name,
          email: user.email,
          wallet_address: user.wallet_address,
        },
      ],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});
router.get("/info", token_verification, async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.username,
    });
    const company = await sc_contract.methods
      .getCompany(req.wallet_address)
      .call();
    const response = {
      company_name: user.display_name,
      username: user.username,
      email: user.email,
      wallet_address: user.wallet_address,
      upstream: company.upstream.length,
      downstream: company.downstream.length,
      supply: company.listOfSupply.length,
      prerequisite: company.listOfPrerequisites.length,
    };
    return res.status(200).json({
      data: [response],
      message: "successfully obtained full info of data",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});
router.get("/all", token_verification, async (req, res) => {
  try {
    const users = await User.find();
    return res.status(200).json({
      message: "obtained all users",
      data: users
        .filter((user) => !user.is_owner)
        .map((user) => {
          return {
            username: user.username,
            wallet_address: user.wallet_address,
          };
        }),
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});
router.post("/login", async (req, res) => {
  if (!req.body.username_or_email)
    return res.status(400).json({
      message: "username or email does not exist in the body",
    });
  if (!req.body.password)
    return res.status(400).json({
      message: "password does not exist in the body",
    });
  const { username_or_email, password } = req.body;
  try {
    let user = await User.findOne({
      username: username_or_email,
    });
    if (!user) {
      user = await User.findOne({
        email: username_or_email,
      });
      if (!user)
        return res.status(404).json({
          message: "credentials does not match",
        });
    }
    if (user.password === "zonk")
      return res.status(404).json({
        message: "account hasn't been created",
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
        owner: user.is_owner,
      },
      dotenv.parsed.JWT_SECRET
    );
    return res
      .cookie("Authorization", `Bearer ${token}`, { maxAge: 1800000 })
      .status(200)
      .json({
        message: "login successful",
        data: [
          {
            username: user.username,
            wallet_address: user.wallet_address,
            display_name: user.display_name,
            email: user.email,
          },
        ],
      });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});
router.post("/logout", async (req, res) => {
  return res.clearCookie("Authorization").status(200).json({
    message: "logout successful",
  });
});
router.post("/register", async (req, res) => {
  if (!req.body.username)
    return res.status(400).json({
      message: "username does not exist in the body",
    });
  if (!req.body.email)
    return res.status(400).json({
      message: "email does not exist in body",
    });
  if (!req.body.password)
    return res.status(400).json({
      message: "password does not exist in the body",
    });
  if (!req.body.wallet_address)
    return res.status(400).json({
      message: "wallet address does not exist in the body",
    });
  const { username, password, email, wallet_address } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashed_password = await bcrypt.hash(password, salt);
  try {
    const user = await User.findOne({
      username,
    });
    if (!user) {
      return res.status(404).json({
        message: "user does not exist",
      });
    }
    if (user.password !== "zonk")
      return res.status(400).json({
        message: "user has been created",
      });
    if (user.email !== email)
      return res.status(400).json({
        message: "email does not match",
      });
    if (user.wallet_address !== wallet_address)
      return res.status(400).json({
        message: "wallet address does not match",
      });
    user.password = hashed_password;
    user.save();
    const token = jwt.sign(
      {
        username,
        wallet_address,
        owner: false,
      },
      dotenv.parsed.JWT_SECRET
    );
    return res
      .cookie("Authorization", `Bearer ${token}`, { maxAge: 1800000 })
      .status(200)
      .json({
        message: "user has been created",
        data: [
          {
            username: user.username,
            wallet_address: user.wallet_address,
            display_name: user.display_name,
            email: user.email,
          },
        ],
      });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
