const { Web3 } = require("web3");
const { abi, networks } = require("../SupplyChainNetwork.json");
const url = "http://127.0.0.1:7545";
const provider = new Web3.providers.HttpProvider(url);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, networks[5777].address);

const crypto = require("crypto");
const company_deserializer = require("./company_deserializer");

module.exports = async (start_node, x) => {
  const visited = {}; // To keep track of visited nodes
  let queue = []; // Queue for BFS traversal
  const x_spacing = 200;
  const y_spacing = 200;

  const companies = [];
  const edges = [];

  queue.push([start_node, 0]);
  visited[start_node] = true;

  while (queue.length > 0) {
    let temp = [];
    const x_offset = (-(queue.length - 1) * x_spacing) / 2;
    for (let i = 0; i < queue.length; i++) {
      const current_company_address = queue[i][0]; // Dequeue the front node
      const level = queue[i][1];
      const current_company = company_deserializer(
        await contract.methods.getCompany(current_company_address).call()
      );

      companies.push({
        ...current_company,
        id: current_company.owner,
        position: {
          x: x + x_offset + i * x_spacing,
          y: level * y_spacing,
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
        if (!visited[neighbor]) {
          temp.push([neighbor, level + 1]); // Enqueue the neighbor
          visited[neighbor] = true; // Mark neighbor as visited
        }
      }
    }
    queue = temp;
  }
  return { companies, edges };
};
