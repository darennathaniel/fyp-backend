const express = require("express");
const router = express.Router();
const token_verification = require("../middleware/token_verification");
const User = require("../schema/User.model");
const company_deserializer = require("../utils/company_deserializer");
const bfs = require("../utils/bfs");

const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

router.post("/", token_verification, async (req, res) => {
  if (!req.body.owner)
    return res.status(400).json({
      message: "owner is not in body",
    });
  if (!req.body.company_name)
    return res.status(400).json({
      message: "company_name is not in body",
    });
  if (!req.body.username)
    return res.status(400).json({
      message: "username is not in body",
    });
  if (!req.owner)
    return res.status(403).json({
      message: "only network owners are allowed",
    });
  try {
    await User.create({
      username: req.body.username,
      password: "zonk",
      wallet_address: req.body.owner,
      is_owner: false,
    });
    await contract.methods
      .addCompany(req.body.owner, req.body.company_name)
      .send({ from: req.wallet_address, gas: "6721975" });
    const company = await contract.methods.getCompany(req.body.owner).call();
    return res.status(200).json({
      message: "company created",
      data: [company],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/", async (req, res) => {
  if (req.query.company_address) {
    const company_address = req.query.company_address;
    try {
      const company = await contract.methods.getCompany(company_address).call();
      if (!company.exist)
        return res.status(404).json({
          message: "company does not exist",
        });
      const { companies, edges } = await bfs(req.query.company_address, 0, 0);
      return res.status(200).json({
        message: "company obtained",
        data: [companies[0], { companies: companies.slice(1), edges }],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    let head_companies = [];
    const head_companies_length = await contract.methods
      .getHeadCompaniesLength()
      .call();
    for (let i = 0; i < head_companies_length; i++) {
      head_companies.push(await contract.methods.headCompanies(i).call());
    }
    const result = { companies: [], edges: [] };
    let x = 0;
    let y = 0;
    for (let i = 0; i < head_companies_length; i++) {
      const { companies, edges } = await bfs(head_companies[i].owner, x, y);
      result.companies.push(...companies);
      result.edges.push(...edges);
      x += 100;
      y += 100;
    }
    res.status(200).json({
      message: "company result",
      data: [result],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
