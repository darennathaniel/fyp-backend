const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const token_verification = require("../middleware/token_verification");
const company_deserializer = require("../utils/company_deserializer");
const product_deserializer = require("../utils/product_deserializer");

const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

router.get("/incoming", token_verification, async (req, res) => {
  if (req.query.contract_id) {
    try {
      const company = company_deserializer(
        await contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_contract = company.incomingContract.filter(
        (contract) => contract.id === Number(req.query.contract_id)
      );
      if (filtered_contract.length === 1) {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(filtered_contract[0].productId)
            .call()
        );
        return res.status(200).json({
          message: "outgoing contracts obtained",
          data: [
            {
              id: filtered_contract[0].id,
              product,
              from: filtered_contract[0].from,
              to: filtered_contract[0].to,
            },
          ],
        });
      }
      return res.status(400).json({
        message: "no such contract in database",
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const company = company_deserializer(
      await contract.methods.getCompany(req.wallet_address).call()
    );
    const incoming_contract = await Promise.all(
      company.incomingContract.map(async (company_contract) => {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(company_contract.productId)
            .call()
        );
        return {
          id: company_contract.id,
          product,
          from: company_contract.from,
          to: company_contract.to,
        };
      })
    );
    return res.status(200).json({
      message: "incoming contracts obtained",
      data: [incoming_contract],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/outgoing", token_verification, async (req, res) => {
  if (req.query.contract_id) {
    try {
      const company = company_deserializer(
        await contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_contract = company.outgoingContract.filter(
        (contract) => contract.id === Number(req.query.contract_id)
      );
      if (filtered_contract.length === 1) {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(filtered_contract[0].productId)
            .call()
        );
        return res.status(200).json({
          message: "outgoing contracts obtained",
          data: [
            {
              id: filtered_contract[0].id,
              product,
              from: filtered_contract[0].from,
              to: filtered_contract[0].to,
            },
          ],
        });
      }
      return res.status(400).json({
        message: "no such contract in database",
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const company = company_deserializer(
      await contract.methods.getCompany(req.wallet_address).call()
    );
    const outgoing_contract = await Promise.all(
      company.outgoingContract.map(async (company_contract) => {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(company_contract.productId)
            .call()
        );
        return {
          id: company_contract.id,
          product,
          from: company_contract.from,
          to: company_contract.to,
        };
      })
    );
    return res.status(200).json({
      message: "outgoing contracts obtained",
      data: [outgoing_contract],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/products", token_verification, async (req, res) => {
  if (!req.query.to)
    return res.status(400).json({
      message: "to address does not exist in body",
    });
  if (req.query.to === req.wallet_address)
    return res.status(400).json({
      message: "cannot send contract to self",
    });
  try {
    const sender_company = company_deserializer(
      await contract.methods.getCompany(req.wallet_address).call()
    );
    const receiver_company = company_deserializer(
      await contract.methods.getCompany(req.query.to).call()
    );
    const sender_products_from_receiver = sender_company.downstream
      .filter((company_product) => company_product.companyId === req.query.to)
      .map((company_product) => company_product.productId);
    const list_of_products = receiver_company.listOfSupply.filter(
      (product) =>
        !sender_products_from_receiver.includes(
          product_deserializer(product).productId
        )
    );
    return res.status(200).json({
      message: `list of available products from company ${req.query.to}`,
      data: [list_of_products],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/", token_verification, async (req, res) => {
  if (!req.body.to)
    return res.status(400).json({
      message: "to address does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (req.body.to === req.wallet_address)
    return res.status(400).json({
      message: "cannot send contract to self",
    });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    const company = company_deserializer(
      await contract.methods.getCompany(req.wallet_address).call()
    );
    if (
      company.downstream.some(
        (company_product) =>
          company_product.companyId === req.body.to &&
          company_product.productId === req.body.product_id
      )
    )
      return res.status(400).json({
        message: "sending the same contract is not allowed!",
      });
    await contract.methods
      .sendContract({
        id,
        from: req.wallet_address,
        to: req.body.to,
        productId: req.body.product_id,
      })
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "contract has been sent",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/approve", token_verification, async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({
      message: "id does not exist in body",
    });
  if (!req.body.from)
    return res.status(400).json({
      message: "from address does not exist in body",
    });
  if (!req.body.to)
    return res.status(400).json({
      message: "to address does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  try {
    await contract.methods
      .approveContract({
        id: req.body.id,
        from: req.body.from,
        to: req.body.to,
        productId: req.body.product_id,
      })
      .send({ from: req.wallet_address, gas: "6721975" });
    res.status(200).json({
      message: "contract has been approved",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/decline", token_verification, async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({
      message: "id does not exist in body",
    });
  if (!req.body.from)
    return res.status(400).json({
      message: "from address does not exist in body",
    });
  if (!req.body.to)
    return res.status(400).json({
      message: "to address does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  try {
    await contract.methods
      .declineContract({
        id: req.body.id,
        from: req.body.from,
        to: req.body.to,
        productId: req.body.product_id,
      })
      .send({ from: req.wallet_address, gas: "6721975" });
    res.status(200).json({
      message: "contract has been declined",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
