const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv").config();
const { Web3 } = require("web3");
const { abi, networks } = require("./SupplyChainNetwork.json");

//For env File
const app = express();
const port = process.env.PORT || 4000;
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

const company_router = require("./router/company.router");
const contract_router = require("./router/contract.router");
const product_router = require("./router/product.router");
const request_router = require("./router/request.router");
const supply_router = require("./router/supply.router");
const user_router = require("./router/user.router");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(function (req, res, next) {
  res.header("Content-Type", "application/json;charset=UTF-8");
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use("/company", company_router);
app.use("/contract", contract_router);
app.use("/product", product_router);
app.use("/request", request_router);
app.use("/supply", supply_router);
app.use("/user", user_router);

// app.get("/", async (req, res) => {
//   const accounts = await web3.eth.getAccounts();
//   const contract = new web3.eth.Contract(abi, networks[5777].address);
//   console.log(
//     await contract.methods.getCompany(accounts[0]).call({ from: accounts[0] })
//   );
//   res.send(`Welcome to Express & TypeScript Server, ${accounts[0]}`);
// });

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
