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

const crypto = require("crypto");
const company_deserializer = require("./company_deserializer");
const product_deserializer = require("./product_deserializer");

module.exports = async (start_node, x, custom) => {
  const visited = {}; // To keep track of visited nodes
  let queue = []; // Queue for BFS traversal
  const x_spacing = 200;
  const y_spacing = 200;

  const companies = [];
  let edges = [];
  const list_of_companies = [];

  queue.push([start_node, 0]);
  visited[start_node] = true;

  while (queue.length > 0) {
    let temp = [];
    const x_offset = (-(queue.length - 1) * x_spacing) / 2;
    for (let i = 0; i < queue.length; i++) {
      const current_company_address = queue[i][0]; // Dequeue the front node
      const level = queue[i][1];
      const current_company = company_deserializer(
        await sc_contract.methods.getCompany(current_company_address).call()
      );
      if (
        list_of_companies.length === 0 ||
        list_of_companies.filter(
          (company) => company.owner === current_company.owner
        ).length === 0
      ) {
        list_of_companies.push(current_company);
        companies.push({
          ...current_company,
          listOfSupply: await Promise.all(
            current_company.listOfSupply.map(async (id) =>
              product_deserializer(
                await p_contract.methods.getProduct(id).call()
              )
            )
          ),
          listOfPrerequisites: await Promise.all(
            current_company.listOfPrerequisites.map(async (id) =>
              product_deserializer(
                await p_contract.methods.getProduct(id).call()
              )
            )
          ),
          id: current_company.owner,
          position: {
            x: x + x_offset + i * x_spacing,
            y: level * y_spacing,
          },
          data: {
            label: current_company.name,
            meta: current_company,
          },
          type: custom ? "customNode" : "default",
        });
      }

      const neighbors = current_company.downstream;
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i].companyId;
        const product = await p_contract.methods
          .getProduct(neighbors[i].productId)
          .call();
        if (
          edges.some(
            (edge) =>
              edge.source === current_company_address &&
              edge.target === neighbor &&
              edge.label.includes(product.productName)
          )
        )
          continue;
        if (
          edges.some(
            (edge) =>
              edge.source === current_company_address &&
              edge.target === neighbor
          )
        ) {
          const index = edges.findIndex(
            (edge) =>
              edge.source === current_company_address &&
              edge.target === neighbor
          );
          edges[index].label += `, ${product.productName}`;
        } else {
          edges.push({
            id: crypto.randomBytes(16).toString("hex"),
            source: current_company_address,
            target: neighbor,
            label: product.productName,
            sourceHandle: "top",
            targetHandle: "bottom",
            type: edges.some(
              (edge) =>
                edge.source === neighbor &&
                edge.target === current_company_address
            )
              ? "customEdge"
              : "default",
          });
          if (
            edges.some(
              (edge) =>
                edge.source === neighbor &&
                edge.target === current_company_address
            )
          ) {
            const updatedEdges = edges.map((oldEdge) => {
              if (
                oldEdge.source === neighbor &&
                oldEdge.target === current_company_address
              ) {
                return {
                  ...oldEdge,
                  type: "customEdge",
                };
              }
              return oldEdge;
            });
            edges = updatedEdges;
          }
        }
        if (!visited[`${neighbor} - ${product.productName}`]) {
          temp.push([neighbor, level + 1]); // Enqueue the neighbor
          visited[`${neighbor} - ${product.productName}`] = true; // Mark neighbor as visited
        }
      }
    }
    queue = temp;
  }
  return { companies, edges, list_of_companies };
};
