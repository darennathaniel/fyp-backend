const express = require("express");
const router = express.Router();
const { contractsc, web3sc } = require("../index");

router.get("/", async (req, res) => {
  const test = await contract.methods.getCompany;
  res.send("product");
});

module.exports = router;
