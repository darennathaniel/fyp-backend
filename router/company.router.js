const express = require("express");
const router = express.Router();
const token_verification = require("../middleware/token_verification");
const User = require("../schema/User.model");

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
    const company = await contract.methods
      .getCompany()
      .call({ from: req.body.owner });
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
  try {
    let head_companies = [];
    const head_companies_length = await contract.methods
      .getHeadCompaniesLength()
      .call();
    for (let i = 0; i < head_companies_length; i++) {
      head_companies.push(await contract.methods.headCompanies(i).call());
    }
    res.status(200).json({
      message: "company result",
      data: head_companies,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

// router.get("/:company_address", async(req,res) => {
//   try {

//   }
// });

module.exports = router;
// app.get("/", async (req, res) => {
//   const accounts = await web3.eth.getAccounts();
//   const contract = new web3.eth.Contract(abi, networks[5777].address);
//   console.log(
//     await contract.methods.getCompany(accounts[0]).call({ from: accounts[0] })
//   );
//   res.send(`Welcome to Express & TypeScript Server, ${accounts[0]}`);
// });
