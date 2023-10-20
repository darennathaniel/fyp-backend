const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const token_verification = require("../middleware/token_verification");
const product_deserializer = require("../utils/product_deserializer");

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
const p_contract = new web3.eth.Contract(
  productContract.abi,
  productContract.networks[5777].address
);

router.get("/", async (req, res) => {
  if (req.query.product_id) {
    const product_id = req.query.product_id;
    try {
      const product = await p_contract.methods
        .listOfProducts(product_id)
        .call();
      const all_company_length = await p_contract.methods
        .getProductOwnerLength(product_id)
        .call();
      let companies = [];
      for (let i = 0; i < all_company_length; i++) {
        const company_address = await p_contract.methods
          .productOwners(product_id, i)
          .call();
        const company = await sc_contract.methods
          .companies(company_address)
          .call();
        companies.push({
          owner: company.owner,
          name: company.name,
        });
      }
      return res.status(200).json({
        message: "product retrieved",
        data: [{ product: product_deserializer(product), companies }],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const all_product_length = await sc_contract.methods
      .getProductLength()
      .call();
    let products = [];
    for (let i = 0; i < all_product_length; i++) {
      products.push(
        product_deserializer(await sc_contract.methods.products(i).call())
      );
    }
    return res.status(200).json({
      message: "all product retrieved",
      data: [products],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

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
  const prerequisite_supplies = req.body.prerequisite_supplies.map((supply) => {
    return {
      productId: supply.product_id,
      productName: supply.product_name,
      exist: true,
    };
  });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    await p_contract.methods
      .addProductWithRecipe(
        id,
        req.body.product_name,
        prerequisite_supplies,
        req.body.quantity_prerequisite_supplies
      )
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    await sc_contract.methods
      .addProduct(id, req.body.product_name, req.wallet_address)
      .send({ from: req.wallet_address, gas: "6721975" });
    const product = await p_contract.methods.listOfProducts(id).call();
    return res.status(200).json({
      message: "product has been created",
      data: [product_deserializer(product)],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
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
    await p_contract.methods
      .addProductWithoutRecipe(id, req.body.product_name, req.body.owner)
      .send({ from: req.wallet_address, gas: "6721975" });
    await sc_contract.methods
      .addProduct(id, req.body.product_name, req.body.owner)
      .send({ from: req.wallet_address, gas: "6721975" });
    const product = await p_contract.methods.listOfProducts(id).call();
    return res.status(200).json({
      message: "product has been created",
      data: [product_deserializer(product)],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
