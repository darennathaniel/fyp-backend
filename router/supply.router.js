const express = require("express");
const router = express.Router();

const Supply = require("../schema/Supply.model");
const token_verification = require("../middleware/token_verification");
const supply_deserializer = require("../utils/supply_deserializer");
const crypto = require("crypto");

const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

router.post("/", token_verification, async (req, res) => {
  if (!req.body.product_id)
    return res
      .status(400)
      .json({ message: "product ID does not exist in body" });
  if (!req.body.number_of_supply)
    return res
      .status(400)
      .json({ message: "number of supply does not exist in body" });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    await contract.methods
      .convertToSupply(req.body.product_id, req.body.number_of_supply, id)
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    const supply = await Supply.create({
      supplyId: id,
      productId: req.body.product_id,
      quantity: req.body.number_of_supply,
      quantity_left: req.body.number_of_supply,
      past: [],
      timestamp: new Date(),
    });
    return res.status(200).json({
      message: "supply converted successfully",
      data: [supply],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/", async (req, res) => {
  if (!req.query.company_address)
    return res.status(400).json({
      message: "user is not logged in and does not specify which company",
    });
  if (!req.query.product_id)
    return res
      .status(400)
      .json({ message: "product ID does not exist in body" });
  try {
    const supply = supply_deserializer(
      await contract.methods
        .getSupply(req.query.product_id)
        .call({ from: req.query.company_address })
    );
    const supplies = await Promise.all(
      supply.supplyId.map(
        async (supply_id) => await Supply.findOne({ supplyId: supply_id })
      )
    );
    return res.status(200).json({
      message: "product supply retrieved",
      data: [{ ...supply, supplies }],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
