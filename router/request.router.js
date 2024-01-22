const express = require("express");
const router = express.Router();

const Supply = require("../schema/Supply.model");
const User = require("../schema/User.model");
const token_verification = require("../middleware/token_verification");
const supply_deserializer = require("../utils/supply_deserializer");
const company_deserializer = require("../utils/company_deserializer");
const product_deserializer = require("../utils/product_deserializer");
const events_deserializer = require("../utils/events_deserializer");
const crypto = require("crypto");

const { Web3 } = require("web3");
const supplyChainNetwork = require("../abi/SupplyChainNetwork.json");
const productContract = require("../abi/ProductContract.json");
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
            .getProduct(filtered_request[0].productId)
            .call()
        );
        const from_company = await User.findOne({
          wallet_address: filtered_request[0].from,
        });
        return res.status(200).json({
          message: "incoming requests obtained",
          data: [
            {
              id: filtered_request[0].id,
              product,
              from: from_company,
              to: filtered_request[0].to,
              quantity: filtered_request[0].quantity,
            },
          ],
        });
      } else {
        const event = events_deserializer(
          await sc_contract.getPastEvents("Requests", {
            filter: {
              requestId: req.query.request_id,
              to: req.wallet_address,
            },
            fromBlock: 0,
            toBlock: "latest",
          })
        );
        if (event.length === 1) {
          const detailed_past_requests = await Promise.all(
            event.map(async (request) => {
              const from_company = await User.findOne({
                wallet_address: request.from,
              });
              const to_company = await User.findOne({
                wallet_address: request.to,
              });
              const product = product_deserializer(
                await p_contract.methods.getProduct(request.productId).call()
              );
              return {
                ...request,
                id: request.requestId,
                from: from_company,
                to: to_company,
                product,
                timestamp: request.timestamp,
              };
            })
          );
          return res.status(200).json({
            message: "incoming request obtained",
            data: [detailed_past_requests],
          });
        }
      }
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
            await p_contract.methods.getProduct(request.productId).call()
          );
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            from: from_company,
            to: request.to,
            quantity: request.quantity,
          };
        })
      );
      const past_requests = events_deserializer(
        await sc_contract.getPastEvents("Requests", {
          filter: { to: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const detailed_past_requests = await Promise.all(
        past_requests.map(async (request) => {
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          return {
            ...request,
            id: request.requestId,
            from: from_company,
            to: to_company,
            product,
            timestamp: request.timestamp,
          };
        })
      );
      requests.push(...incoming_requests, ...detailed_past_requests);
    } else if (timeline === "current") {
      const incoming_requests = await Promise.all(
        company.incomingRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            from: from_company,
            to: request.to,
            quantity: request.quantity,
          };
        })
      );
      requests.push(...incoming_requests);
    } else if (timeline === "past") {
      const past_requests = events_deserializer(
        await sc_contract.getPastEvents("Requests", {
          filter: { to: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const detailed_past_requests = await Promise.all(
        past_requests.map(async (request) => {
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          return {
            ...request,
            id: request.requestId,
            from: from_company,
            to: to_company,
            product,
            timestamp: request.timestamp,
          };
        })
      );
      requests.push(...detailed_past_requests);
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
            .getProduct(filtered_request[0].productId)
            .call()
        );
        const to_company = await User.findOne({
          wallet_address: filtered_request[0].to,
        });
        return res.status(200).json({
          message: "outgoing request obtained",
          data: [
            {
              id: filtered_request[0].id,
              product,
              from: filtered_request[0].from,
              to: to_company,
              quantity: filtered_request[0].quantity,
            },
          ],
        });
      } else {
        const event = events_deserializer(
          await sc_contract.getPastEvents("Requests", {
            filter: {
              requestId: req.query.request_id,
              from: req.wallet_address,
            },
            fromBlock: 0,
            toBlock: "latest",
          })
        );
        if (event.length === 1) {
          const detailed_past_requests = await Promise.all(
            event.map(async (request) => {
              const from_company = await User.findOne({
                wallet_address: request.from,
              });
              const to_company = await User.findOne({
                wallet_address: request.to,
              });
              const product = product_deserializer(
                await p_contract.methods.getProduct(request.productId).call()
              );
              return {
                ...request,
                id: request.requestId,
                from: from_company,
                to: to_company,
                product,
                timestamp: request.timestamp,
              };
            })
          );
          return res.status(200).json({
            message: "outgoing request obtained",
            data: [detailed_past_requests],
          });
        }
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
      const outgoing_requests = await Promise.all(
        company.outgoingRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const to_company = User.findOne({
            wallet_address: request.to,
          });
          return {
            id: request.id,
            product,
            from: request.from,
            to: to_company,
            quantity: request.quantity,
          };
        })
      );
      const past_requests = events_deserializer(
        await sc_contract.getPastEvents("Requests", {
          filter: { from: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const detailed_past_requests = await Promise.all(
        past_requests.map(async (request) => {
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          return {
            ...request,
            id: request.requestId,
            from: from_company,
            to: to_company,
            product,
            timestamp: request.timestamp,
          };
        })
      );
      requests.push(...outgoing_requests, ...detailed_past_requests);
    } else if (timeline === "current") {
      const outgoing_requests = await Promise.all(
        company.outgoingRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          return {
            id: request.id,
            product,
            from: request.from,
            to: to_company,
            quantity: request.quantity,
          };
        })
      );
      requests.push(...outgoing_requests);
    } else if (timeline === "past") {
      const past_requests = events_deserializer(
        await sc_contract.getPastEvents("Requests", {
          filter: { from: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const detailed_past_requests = await Promise.all(
        past_requests.map(async (request) => {
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          return {
            ...request,
            id: request.requestId,
            from: from_company,
            to: to_company,
            product,
            timestamp: request.timestamp,
          };
        })
      );
      requests.push(...detailed_past_requests);
    }
    return res.status(200).json({
      message: "outgoing requests obtained",
      data: [requests],
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
      message: "cannot send request to self",
    });
  const downstream = company_deserializer(
    await sc_contract.methods.getCompany(req.wallet_address).call()
  ).downstream;
  if (
    downstream.filter((company) => company.companyId === req.body.to).length ===
    0
  )
    return res.status(400).json({
      message: `you have no request with company ${req.body.to}`,
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
      message: "only to address are allowed to decline the request",
    });
  try {
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
    return res.status(200).json({
      message: "request has been approved",
      data: [],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
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
      message: "only to address are allowed to decline the request",
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
    return res.status(200).json({
      message: "request has been declined",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete", token_verification, async (req, res) => {
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  try {
    const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
    await sc_contract.methods
      .sendDeleteRequest(id, req.body.product_id)
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      data: [],
      message: "delete supply request has been sent",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete/approve", token_verification, async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({
      message: "delete request ID does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (!req.body.from)
    return res.status(400).json({
      message: "from address does not exist in body",
    });
  try {
    await sc_contract.methods
      .respondDeleteRequest(
        req.body.id,
        req.body.product_id,
        req.body.from,
        true
      )
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    return res.status(200).json({
      data: [],
      message: "successfully approved the delete supply request",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete/decline", async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({
      message: "delete request ID does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (!req.body.from)
    return res.status(400).json({
      message: "from address does not exist in body",
    });
  try {
    await sc_contract.methods
      .respondDeleteRequest(
        req.body.id,
        req.body.product_id,
        req.body.from,
        false
      )
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    return res.status(200).json({
      data: [],
      message: "successfully declined the delete supply request",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.delete("/delete", token_verification, async (req, res) => {
  if (!req.query.id)
    return res.status(400).json({
      message: "delete request ID does not exist in body",
    });
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const request = company.outgoingDeleteRequests.filter(
      (request) => request.id === req.query.id
    );
    const filter_upstream = company.upstream.filter(
      (upstream) => upstream.productId !== request.productId
    );
    await sc_contract.methods
      .deleteSupply(req.query.id, filter_upstream)
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "product has been deleted from supply list",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
