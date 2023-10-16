const express = require("express");
const router = express.Router();

const token_verification = require("../middleware/token_verification");
const company_deserializer = require("../utils/company_deserializer");
const product_deserializer = require("../utils/product_deserializer");
const crypto = require("crypto");

const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

router.get("/incoming", token_verification, async (req, res) => {
  if (req.query.request_id) {
    try {
      const company = company_deserializer(
        await contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_request = company.incomingRequests.filter(
        (request) => request.id === Number(req.query.request_id)
      );
      if (filtered_request.length === 1) {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(filtered_request[0].productId)
            .call()
        );
        return res.status(200).json({
          message: "outgoing requests obtained",
          data: [
            {
              id: filtered_request[0].id,
              product,
              from: filtered_request[0].from,
              to: filtered_request[0].to,
              quantity: filtered_request[0].quantity,
            },
          ],
        });
      }
      return res.status(400).json({
        message: "no such request in database",
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
      company.incomingRequests.map(async (request) => {
        const product = product_deserializer(
          await contract.methods.listOfProducts(request.productId).call()
        );
        return {
          id: request.id,
          product,
          from: request.from,
          to: request.to,
          quantity: request.quantity,
        };
      })
    );
    return res.status(200).json({
      message: "incoming requests obtained",
      data: [incoming_contract],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/outgoing", token_verification, async (req, res) => {
  if (req.query.request_id) {
    try {
      const company = company_deserializer(
        await contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_request = company.outgoingRequests.filter(
        (request) => request.id === Number(req.query.request_id)
      );
      if (filtered_request.length === 1) {
        const product = product_deserializer(
          await contract.methods
            .listOfProducts(filtered_request[0].productId)
            .call()
        );
        return res.status(200).json({
          message: "outgoing requests obtained",
          data: [
            {
              id: filtered_request[0].id,
              product,
              from: filtered_request[0].from,
              to: filtered_request[0].to,
              quantity: filtered_request[0].quantity,
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
      company.outgoingRequests.map(async (request) => {
        const product = product_deserializer(
          await contract.methods.listOfProducts(request.productId).call()
        );
        return {
          id: request.id,
          product,
          from: request.from,
          to: request.to,
          quantity: request.quantity,
        };
      })
    );
    return res.status(200).json({
      message: "outgoing requests obtained",
      data: [outgoing_contract],
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
  if (!req.body.quantity)
    return res.status(400).json({
      message: "quantity does not exist in body",
    });
  if (req.body.to === req.wallet_address)
    return res.status(400).json({
      message: "cannot send contract to self",
    });
  const downstream = company_deserializer(
    await contract.methods.getCompany(req.wallet_address).call()
  ).downstream;
  if (
    downstream.filter((company) => company.companyId === req.body.to).length ===
    0
  )
    return res.status(400).json({
      message: `you have no contract with company ${req.body.to}`,
    });
  const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
  try {
    await contract.methods
      .sendRequest({
        id,
        from: req.wallet_address,
        to: req.body.to,
        productId: req.body.product_id,
        quantity: req.body.quantity,
      })
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "request has been sent",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

// TODO: work in progress i.e not done
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
  if (!req.body.quantity)
    return res.status(400).json({
      message: "quantity does not exist in body",
    });
  if (req.body.to !== req.wallet_address)
    return res.status(403).json({
      message: "only to address are allowed to decline the contract",
    });
  // TODO: check if supply is more than equals to requested
  // if not return error
  try {
    // TODO: left with supplyIdsAndQuantities parameter
    await contract.methods
      .approveRequest({
        id: req.body.id,
        from: req.body.from,
        to: req.body.to,
        productId: req.body.product_id,
        quantity: req.body.quantity,
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
  if (!req.body.quantity)
    return res.status(400).json({
      message: "quantity does not exist in body",
    });
  if (req.body.to !== req.wallet_address)
    return res.status(403).json({
      message: "only to address are allowed to decline the contract",
    });
  try {
    await contract.methods
      .declineRequest({
        id: req.body.id,
        from: req.body.from,
        to: req.body.to,
        productId: req.body.product_id,
        quantity: req.body.quantity,
      })
      .send({ from: req.wallet_address, gas: "6721975" });
    res.status(200).json({
      message: "request has been declined",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
