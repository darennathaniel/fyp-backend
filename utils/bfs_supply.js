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
const past_supply_deserializer = require("./past_supply_deserializer");
const product_deserializer = require("./product_deserializer");
const Supply = require("../schema/Supply.model");
const User = require("../schema/User.model");

module.exports = async (start_node, x) => {
  const visited = {}; // To keep track of visited nodes
  let queue = []; // Queue for BFS traversal
  const x_spacing = 200;
  const y_spacing = 200;

  const supplies = [];
  const edges = [];

  queue.push([start_node, 0]);
  visited[start_node] = true;
  try {
    while (queue.length > 0) {
      let temp = [];
      const x_offset = (-(queue.length - 1) * x_spacing) / 2;
      for (let i = 0; i < queue.length; i++) {
        const current_supply_id = queue[i][0]; // Dequeue the front node
        const level = queue[i][1];
        const supply = await Supply.findOne({ supplyId: current_supply_id });
        const product = product_deserializer(
          await p_contract.methods.getProduct(supply.productId).call()
        );
        const user = await User.findOne({ wallet_address: supply.owner });
        supplies.push({
          ...supply._doc,
          id: supply.supplyId.toString(),
          position: {
            x: x + x_offset + i * x_spacing,
            y: level * y_spacing,
          },
          product,
          user,
          data: {
            label: `${product.productName}`,
            meta: { ...supply._doc, product, user },
          },
          type: "customNode",
        });
        try {
          const current_supply = past_supply_deserializer(
            await sc_contract.methods.getPastSupply(current_supply_id).call()
          );
          const neighbors = current_supply.pastSupply;
          for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const neighbor_supply = await Supply.findOne({
              supplyId: neighbor,
            });
            if (!visited[neighbor_supply.productId]) {
              edges.push({
                id: crypto.randomBytes(16).toString("hex"),
                source: current_supply_id.toString(),
                target: neighbor.toString(),
                sourceHandle: "top",
                targetHandle: "bottom",
                // label: `${product.productName} + ${
                //   product_deserializer(
                //     await p_contract.methods
                //       .getProduct(neighbor_supply.productId)
                //       .call()
                //   ).productName
                // }`,
              });
              temp.push([neighbor, level + 1]); // Enqueue the neighbor
              visited[neighbor_supply.productId] = true; // Mark neighbor as visited
            }
          }
        } catch (err) {
          console.log("no more past supplies");
        }
        queue = temp;
      }
    }
  } catch (err) {
    return { supplies, edges };
  }
  return { supplies, edges };
};
