const express = require("express");
const router = express.Router();
const token_verification = require("../middleware/token_verification");
const User = require("../schema/User.model");
const bfs = require("../utils/bfs_company");
const company_deserializer = require("../utils/company_deserializer");

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
  if (!req.body.email)
    return res.status(400).json({
      message: "email is not in body",
    });
  if (!req.owner)
    return res.status(403).json({
      message: "only network owners are allowed",
    });
  try {
    await User.create({
      username: req.body.username,
      password: "zonk",
      email: req.body.email,
      wallet_address: req.body.owner,
      is_owner: false,
      company_name: req.body.company_name,
    });
    await sc_contract.methods
      .addCompany(req.body.owner, req.body.company_name)
      .send({ from: req.wallet_address, gas: "6721975" });
    await p_contract.methods
      .addCompany(req.body.owner)
      .send({ from: req.wallet_address, gas: "6721975" });
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.body.owner).call()
    );
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
      const company = await sc_contract.methods
        .getCompany(company_address)
        .call();
      if (!company.exist)
        return res.status(404).json({
          message: "company does not exist",
        });
      const { companies, edges } = await bfs(
        req.query.company_address,
        0,
        false
      );
      return res.status(200).json({
        message: "company obtained",
        data: [companies[0], { companies: companies, edges }],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    let head_companies = [];
    const head_companies_length = await sc_contract.methods
      .getHeadCompaniesLength()
      .call();
    for (let i = 0; i < head_companies_length; i++) {
      head_companies.push(await sc_contract.methods.headCompanies(i).call());
    }
    const result = { companies: [], edges: [], list_of_companies: [] };
    let x = 0;
    const x_offset = 400;
    for (let i = 0; i < head_companies_length; i++) {
      const { companies, edges, list_of_companies } = await bfs(
        head_companies[i].owner,
        x,
        true
      );
      result.companies.push(...companies);
      result.edges.push(...edges);
      list_of_companies.forEach((company) => {
        if (
          result.list_of_companies.length === 0 ||
          result.list_of_companies.filter(
            (all_company) => all_company.owner === company.owner
          ).length === 0
        )
          result.list_of_companies.push(company);
      });
      x += x_offset;
    }
    res.status(200).json({
      message: "company result",
      data: [
        result.list_of_companies,
        { companies: result.companies, edges: result.edges },
      ],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

module.exports = router;
