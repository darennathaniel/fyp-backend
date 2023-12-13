const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const token_verification = require("../middleware/token_verification");
const product_deserializer = require("../utils/product_deserializer");
const supply_deserializer = require("../utils/supply_deserializer");
const company_deserializer = require("../utils/company_deserializer");
const User = require("../schema/User.model");

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
      const companies = [];
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
  if (req.query.company_address) {
    try {
      const company = company_deserializer(
        await sc_contract.methods.getCompany(req.query.company_address).call()
      );
      const response = await Promise.all(
        company.listOfSupply.map(async (product_id) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(product_id).call()
          );
          let supply;
          try {
            supply = supply_deserializer(
              await sc_contract.methods
                .getSupply(product_id)
                .call({ from: req.query.company_address })
            );
          } catch (err) {
            supply = {
              total: 0,
              supplyId: [],
              quantities: [],
            };
          }
          return {
            ...product,
            ...supply,
          };
        })
      );
      return res.status(200).json({
        message: "successfully obtained all company product details",
        data: [response],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const all_product_length = await p_contract.methods
      .getProductLength()
      .call();
    const products = [];
    for (let i = 0; i < all_product_length; i++) {
      products.push(
        product_deserializer(await p_contract.methods.products(i).call())
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

router.get("/my", token_verification, async (req, res) => {
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const response = await Promise.all(
      company.listOfSupply.map(async (product_id) => {
        const product = product_deserializer(
          await p_contract.methods.listOfProducts(product_id).call()
        );
        let supply;
        try {
          supply = supply_deserializer(
            await sc_contract.methods
              .getSupply(product_id)
              .call({ from: req.wallet_address })
          );
        } catch (err) {
          supply = {
            total: 0,
            supplyId: [],
            quantities: [],
          };
        }
        return {
          ...product,
          ...supply,
        };
      })
    );
    return res.status(200).json({
      message: "successfully obtained all company product details",
      data: [response],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/prerequisite", async (req, res) => {
  if (!req.query.company_address)
    return res.status(400).json({
      message: "company address does not exist in body",
    });
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.query.company_address).call()
    );
    const response = await Promise.all(
      company.downstream.map(async (company_product) => {
        const company_user = await User.findOne({
          wallet_address: company_product.companyId,
        });
        const product = product_deserializer(
          await p_contract.methods
            .listOfProducts(company_product.productId)
            .call()
        );
        const supply = supply_deserializer(
          await sc_contract.methods
            .getPrerequisiteSupply(company_product.productId)
            .call({ from: req.query.company_address })
        );
        return {
          owner: `${company_user.company_name} - ${company_user.wallet_address}`,
          ...product,
          ...supply,
        };
      })
    );
    return res.status(200).json({
      message:
        "successfully obtained all prerequisite supply details for a company",
      data: [response],
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
  const seen = {};
  const hasDuplicates = req.body.prerequisite_supplies.some(function (
    currentObject
  ) {
    if (seen.hasOwnProperty(currentObject.name)) {
      return true;
    }
    return (seen[currentObject.name] = false);
  });
  if (hasDuplicates)
    return res.status(400).json({
      message: "please remove any duplicate recipes",
    });
  if (!req.body.quantity_prerequisite_supplies)
    return res.status(400).json({
      message: "quantity prerequisite supplies does not exist in body",
    });
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const prerequisite_supplies = await Promise.all(
      req.body.prerequisite_supplies.map(async (supply) => {
        return {
          productId: supply.product_id,
          productName: supply.product_name,
          exist: true,
          has_recipe: false,
        };
      })
    );
    const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
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
      data: [{ ...product_deserializer(product), total: 0 }],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
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
