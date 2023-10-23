const express = require("express");
const router = express.Router();

const Supply = require("../schema/Supply.model");
const token_verification = require("../middleware/token_verification");
const supply_deserializer = require("../utils/supply_deserializer");
const company_deserializer = require("../utils/company_deserializer");
const product_deserializer = require("../utils/product_deserializer");
const events_deserializer = require("../utils/events_deserializer");
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

router.get("/incoming", token_verification, async (req, res) => {
  if (req.query.request_id) {
    try {
      const company = company_deserializer(
        await sc_contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_request = company.incomingRequests.filter(
        (request) => request.id === Number(req.query.request_id)
      );
      if (filtered_request.length === 1) {
        const product = product_deserializer(
          await p_contract.methods
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
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const { timeline = "all" } = req.query;
    const requests = [];
    if (timeline === "all") {
      const incoming_requests = await Promise.all(
        company.incomingRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
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
      const past_requests = events_deserializer(
        await sc_contract.getPastEvents("Requests", {
          to: req.wallet_address,
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      requests.push(...incoming_requests, ...past_requests);
    } else if (timeline === "current") {
      const incoming_requests = await Promise.all(
        company.incomingRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
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
      requests.push(...incoming_requests);
    } else if (timeline === "past") {
      requests.push(
        ...events_deserializer(
          await sc_contract.getPastEvents("Requests", {
            to: req.wallet_address,
            fromBlock: 0,
            toBlock: "latest",
          })
        )
      );
    }
    return res.status(200).json({
      message: "incoming requests obtained",
      data: [requests],
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
        await sc_contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_request = company.outgoingRequests.filter(
        (request) => request.id === Number(req.query.request_id)
      );
      if (filtered_request.length === 1) {
        const product = product_deserializer(
          await p_contract.methods
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
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const outgoing_contract = await Promise.all(
      company.outgoingRequests.map(async (request) => {
        const product = product_deserializer(
          await p_contract.methods.listOfProducts(request.productId).call()
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
    await sc_contract.methods.getCompany(req.wallet_address).call()
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
    await sc_contract.methods
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
  const supplies = supply_deserializer(
    await sc_contract.methods
      .getSupply(req.body.product_id)
      .call({ from: req.wallet_address })
  );
  if (supplies.total < req.body.quantity)
    return res.status(400).json({
      message:
        "supplier does not have enough stock to proceed with the request",
    });
  try {
    let counter = req.body.quantity;
    let index = 0;
    const supply_ids = [];
    const quantities = [];
    const supply_schema = await Supply.find({ productId: req.body.product_id });
    supply_schema.sort((a, b) => a.timestamp - b.timestamp);
    while (counter > 0) {
      const current_supply = supply_schema[index];
      let decrement = Math.min(counter, current_supply.quantity_left);
      supply_ids.push(current_supply.supplyId);
      quantities.push(decrement);
      counter -= decrement;
      supply_schema[index].quantity_left -= decrement;
      index += 1;
    }
    await sc_contract.methods
      .approveRequest(
        {
          id: req.body.id,
          from: req.body.from,
          to: req.body.to,
          productId: req.body.product_id,
          quantity: req.body.quantity,
        },
        supply_ids,
        quantities
      )
      .send({ from: req.wallet_address, gas: "6721975" });
    supply_schema.forEach((schema) => schema.save());
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
    await sc_contract.methods
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
