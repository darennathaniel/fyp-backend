const express = require("express");
const router = express.Router();

const Supply = require("../schema/Supply.model");
const token_verification = require("../middleware/token_verification");
const product_deserializer = require("../utils/product_deserializer");
const supply_deserializer = require("../utils/supply_deserializer");
const recipe_deserializer = require("../utils/recipe_deserializer");
const bfs = require("../utils/bfs_supply");
const crypto = require("crypto");

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
    await sc_contract.methods
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

router.post("/prerequisite", token_verification, async (req, res) => {
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (!req.body.number_of_supply)
    return res.status(400).json({
      message: "number of supply does not exist in body",
    });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    const recipe = recipe_deserializer(
      await p_contract.methods
        .getRecipe(req.body.product_id)
        .call({ from: req.wallet_address })
    );
    const prerequisites = recipe.prerequisites;
    const quantities = recipe.quantities;
    const prerequisite_supply_ids = [];
    const prerequisite_quantities = [];
    const prerequisite_product_ids = [];
    await Promise.all(
      prerequisites.map(async (prerequisite, idx) => {
        const prerequisite_deserialize = product_deserializer(prerequisite);
        prerequisite_product_ids.push(prerequisite_deserialize.productId);
        const prerequisite_supply = supply_deserializer(
          await sc_contract.methods
            .getPrerequisiteSupply(prerequisite_deserialize.productId)
            .call({ from: req.wallet_address })
        );
        let quantity = quantities[idx] * req.body.number_of_supply;
        if (prerequisite_supply.total < quantity) {
          throw Error(
            `${prerequisite_deserialize.productName}'s supply is less than request`
          );
        }
        const supply_schema = await Promise.all(
          prerequisite_supply.supplyId.map(async (supplyId, idx) => {
            const schema = await Supply.findOne({ supplyId });
            return {
              supplyId: schema.supplyId,
              productId: schema.productId,
              quantity: prerequisite_supply.quantities[idx],
              timestamp: schema.timestamp,
            };
          })
        );
        supply_schema.sort((a, b) => a.timestamp - b.timestamp);
        let index = 0;
        while (quantity > 0) {
          const current_supply = supply_schema[index];
          let decrement = Math.min(current_supply.quantity, quantity);
          prerequisite_supply_ids.push(current_supply.supplyId);
          prerequisite_quantities.push(decrement);
          quantity -= decrement;
          index += 1;
        }
      })
    );
    await sc_contract.methods
      .convertPrerequisiteToSupply(
        req.body.product_id,
        req.body.number_of_supply,
        id,
        prerequisite_product_ids,
        prerequisite_supply_ids,
        prerequisite_quantities
      )
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    const supply = await Supply.create({
      supplyId: id,
      productId: req.body.product_id,
      quantity: req.body.number_of_supply,
      quantity_left: req.body.number_of_supply,
      timestamp: new Date(),
    });
    return res.status(200).json({
      message: "prerequisite supply converted to product supply",
      data: [
        {
          ...supply,
          product: product_deserializer(
            await p_contract.methods.listOfProducts(req.body.product_id).call()
          ),
        },
      ],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/product", async (req, res) => {
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
      await sc_contract.methods
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

router.get("/prerequisite", async (req, res) => {
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
      await sc_contract.methods
        .getPrerequisiteSupply(req.query.product_id)
        .call({ from: req.query.company_address })
    );
    const supplies = await Promise.all(
      supply.supplyId.map(
        async (supply_id) => await Supply.findOne({ supplyId: supply_id })
      )
    );
    return res.status(200).json({
      message: "product prerequisite supply retrieved",
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

router.get("/", async (req, res) => {
  if (req.query.supply_id) {
    try {
      const { supplies, edges } = await bfs(req.query.supply_id, 0);
      const result = {
        supplies,
        edges,
      };
      return res.status(200).json({
        message: "supply track result",
        data: [result],
      });
    } catch (err) {
      if (err.name && err.name === "ContractExecutionError")
        return res.status(400).json({ message: err.innerError.message });
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const { page = 1, limit = 10, sort = -1 } = req.query;
    const supplies_schema = await Supply.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ timestamp: sort * 1 });
    const count = await Supply.countDocuments();
    const supplies = await Promise.all(
      supplies_schema.map(async (supply) => {
        return {
          ...supply._doc,
          product: product_deserializer(
            await p_contract.methods.listOfProducts(supply.productId).call()
          ),
        };
      })
    );
    return res.status(200).json({
      message: `page ${page} of supply retrieved`,
      data: [
        {
          supplies,
          total_pages: Math.ceil(count / limit),
          current_page: page,
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
