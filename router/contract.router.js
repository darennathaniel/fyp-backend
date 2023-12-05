const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../schema/User.model");

const token_verification = require("../middleware/token_verification");
const company_deserializer = require("../utils/company_deserializer");
const product_deserializer = require("../utils/product_deserializer");
const events_deserializer = require("../utils/events_deserializer");

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
  if (req.query.contract_id) {
    try {
      const company = company_deserializer(
        await sc_contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_contract = company.incomingContract.filter(
        (contract) => contract.id === Number(req.query.contract_id)
      );
      if (filtered_contract.length === 1) {
        const product = product_deserializer(
          await p_contract.methods
            .listOfProducts(filtered_contract[0].productId)
            .call()
        );
        const from_company = await User.findOne({
          wallet_address: filtered_contract[0].from,
        });
        return res.status(200).json({
          message: "outgoing contracts obtained",
          data: [
            {
              id: filtered_contract[0].id,
              product,
              from: from_company,
              to: filtered_contract[0].to,
            },
          ],
        });
      } else {
        const event = events_deserializer(
          await sc_contract.getPastEvents("Contracts", {
            filter: {
              contractId: req.query.contract_id,
              to: req.wallet_address,
            },
            fromBlock: 0,
            toBlock: "latest",
          })
        );
        if (event.length === 1) {
          return res.status(200).json({
            message: "incoming contract obtained",
            data: [event],
          });
        }
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
    const { timeline = "all" } = req.query;
    const contracts = [];
    if (timeline === "all") {
      const incoming_contract = await Promise.all(
        company.incomingContract.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
          );
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            from: from_company,
            to: request.to,
          };
        })
      );
      const past_contracts = events_deserializer(
        await sc_contract.getPastEvents("Contracts", {
          filter: { to: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      contracts.push(...incoming_contract, ...past_contracts);
    } else if (timeline === "current") {
      const incoming_contract = await Promise.all(
        company.incomingContract.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
          );
          const from_company = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            from: from_company,
            to: request.to,
          };
        })
      );
      contracts.push(...incoming_contract);
    } else if (timeline === "past") {
      contracts.push(
        ...events_deserializer(
          await sc_contract.getPastEvents("Contracts", {
            filter: { to: req.wallet_address },
            fromBlock: 0,
            toBlock: "latest",
          })
        )
      );
    }
    return res.status(200).json({
      message: "incoming contracts obtained",
      data: [contracts],
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
        await sc_contract.methods.getCompany(req.wallet_address).call()
      );
      const filtered_contract = company.outgoingContract.filter(
        (contract) => contract.id === Number(req.query.contract_id)
      );
      if (filtered_contract.length === 1) {
        const product = product_deserializer(
          await p_contract.methods
            .listOfProducts(filtered_contract[0].productId)
            .call()
        );
        const to_company = await User.findOne({
          wallet_address: request.to,
        });
        return res.status(200).json({
          message: "outgoing contracts obtained",
          data: [
            {
              id: filtered_contract[0].id,
              product,
              from: filtered_contract[0].from,
              to: to_company,
            },
          ],
        });
      } else {
        const event = events_deserializer(
          await sc_contract.getPastEvents("Contracts", {
            filter: {
              contractId: req.query.contract_id,
              from: req.wallet_address,
            },
            fromBlock: 0,
            toBlock: "latest",
          })
        );
        if (event.length === 1) {
          return res.status(200).json({
            message: "outgoing contract obtained",
            data: [event],
          });
        }
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
    const { timeline = "all" } = req.query;
    const contracts = [];
    if (timeline === "all") {
      const outgoing_contract = await Promise.all(
        company.outgoingContract.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
          );
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          return {
            id: request.id,
            product,
            from: request.from,
            to: to_company,
          };
        })
      );
      const past_contracts = events_deserializer(
        await sc_contract.getPastEvents("Contracts", {
          filter: { from: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      contracts.push(...outgoing_contract, ...past_contracts);
    } else if (timeline === "current") {
      const outgoing_contract = await Promise.all(
        company.outgoingContract.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.listOfProducts(request.productId).call()
          );
          const to_company = await User.findOne({
            wallet_address: request.to,
          });
          return {
            id: request.id,
            product,
            from: request.from,
            to: to_company,
          };
        })
      );
      contracts.push(...outgoing_contract);
    } else if (timeline === "past") {
      contracts.push(
        ...events_deserializer(
          await sc_contract.getPastEvents("contracts", {
            filter: { from: req.wallet_address },
            fromBlock: 0,
            toBlock: "latest",
          })
        )
      );
    }
    return res.status(200).json({
      message: "outgoing contracts obtained",
      data: [contracts],
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
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const receiver_company = company_deserializer(
      await sc_contract.methods.getCompany(req.query.to).call()
    );
    const sender_products_from_receiver = sender_company.downstream
      .filter((company_product) => company_product.companyId === req.query.to)
      .map((company_product) => company_product.productId);

    const list_of_products = receiver_company.listOfSupply.filter(
      (product_id) => !sender_products_from_receiver.includes(product_id)
    );
    const fetched_products = await Promise.all(
      list_of_products.map(async (product_id) =>
        product_deserializer(
          await p_contract.methods.listOfProducts(product_id).call()
        )
      )
    );
    return res.status(200).json({
      message: `list of available products from company ${req.query.to}`,
      data: [fetched_products],
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
      await sc_contract.methods.getCompany(req.wallet_address).call()
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
    await sc_contract.methods
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
  if (req.body.to !== req.wallet_address)
    return res.status(403).json({
      message: "only to address are allowed to decline the contract",
    });
  try {
    await sc_contract.methods
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
  if (req.body.to !== req.wallet_address)
    return res.status(403).json({
      message: "only to address are allowed to decline the contract",
    });
  try {
    await sc_contract.methods
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
