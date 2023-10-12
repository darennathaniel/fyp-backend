const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const token_verification = require("../middleware/token_verification");

const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

router.post("/", token_verification, async (req, res) => {
  if (!req.body.product_name)
    return res.status(400).json({
      message: "product name does not exist in body",
    });
  if (!req.body.prerequisite_supplies)
    return res.status(400).json({
      message: "prerequisite supplies does not exist in body",
    });
  if (!req.body.quantity_prerequisite_supplies)
    return res.status(400).json({
      message: "quantity prerequisite supplies does not exist in body",
    });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  // TODO: with_recipe endpoint
});

router.post("/no_recipe", token_verification, async (req, res) => {
  if (!req.body.product_name)
    return res.status(400).json({
      message: "product name does not exist in body",
    });
  if (!req.body.owner)
    return res.status(400).json({
      message: "owner address does not exist in body",
    });
  if (!req.owner)
    return res.status(403).json({
      message: "only network owners are allowed",
    });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    await contract.methods
      .addProductWithoutRecipe(id, req.body.product_name, req.body.owner)
      .send({ from: req.wallet_address, gas: "6721975" });
    const product = await contract.methods.listOfProducts(id).call();
    return res.status(200).json({
      message: "product has been created",
      data: [
        {
          product_id: product.productId.toString(),
          product_name: product.productName,
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
