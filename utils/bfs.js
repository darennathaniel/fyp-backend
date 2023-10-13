const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

const crypto = require("crypto");
const company_deserializer = require("./company_deserializer");

module.exports = async (start_node, x, y) => {
  const visited = {}; // To keep track of visited nodes
  let queue = []; // Queue for BFS traversal

  const companies = [];
  const edges = [];

  queue.push([start_node, x, y]);
  visited[start_node] = true;

  let y_counter = y + 100;

  while (queue.length > 0) {
    let x_counter = x;
    let temp = [];
    for (let i = 0; i < queue.length; i++) {
      const current_company_address = queue[i][0]; // Dequeue the front node
      const current_x = queue[i][1];
      const current_y = queue[i][2];
      const current_company = company_deserializer(
        await contract.methods.getCompany(current_company_address).call()
      );

      companies.push({
        ...current_company,
        id: current_company.owner,
        position: {
          x: current_x,
          y: current_y,
        },
        data: {
          label: current_company.name,
        },
      });

      const neighbors = current_company.downstream;
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i].companyId;
        edges.push({
          id: crypto.randomBytes(16).toString("hex"),
          source: current_company_address,
          target: neighbors[i].companyId,
        });
        x_counter += 100;
        if (!visited[neighbor]) {
          temp.push([neighbor, x_counter, y_counter]); // Enqueue the neighbor
          visited[neighbor] = true; // Mark neighbor as visited
        }
      }
    }
    queue = temp;
    y_counter += 100;
  }
  return { companies, edges };
};
