import express, { Request, Response, Application } from "express";
import dotenv from "dotenv";
import Web3, { ContractAbi } from "web3";
import CONTACT_ABI from "./SupplyChainNetwork.json";
import type { SupplyChainNetworkContract } from "./types/truffle-contracts/SupplyChainNetwork";

//For env File
dotenv.config();
const app: Application = express();
const port = process.env.PORT || 4000;
const url = "http://127.0.0.1:7545";
const web3 = new Web3(new Web3.providers.HttpProvider(url));

app.get("/", async (req: Request, res: Response) => {
  const accounts = await web3.eth.getAccounts();
  const contract = new web3.eth.Contract(
    CONTACT_ABI.abi as any,
    CONTACT_ABI.networks[5777].address
  ) as unknown as SupplyChainNetworkContract;
  console.log(
    await contract.methods.getCompany(accounts[0]).call({ from: accounts[0] })
  );
  res.send(`Welcome to Express & TypeScript Server, ${accounts[0]}`);
});

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
