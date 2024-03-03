const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const token_verification = require("../middleware/token_verification");
const product_deserializer = require("../utils/product_deserializer");
const recipe_deserializer = require("../utils/recipe_deserializer");
const supply_deserializer = require("../utils/supply_deserializer");
const company_deserializer = require("../utils/company_deserializer");
const company_delete_request_deserializer = require("../utils/company_delete_request_deserializer");
const delete_request_event_deserializer = require("../utils/delete_request_event_deserializer");
const User = require("../schema/User.model");
const ProductRequest = require("../schema/ProductRequest.model");

const { Web3 } = require("web3");
const supplyChainNetwork = require("../abi/SupplyChainNetwork.json");
const productContract = require("../abi/ProductContract.json");
const deleteContract = require("../abi/DeleteRequestContract.json");
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
const delete_contract = new web3.eth.Contract(
  deleteContract.abi,
  deleteContract.networks[5777].address
);

router.get("/", async (req, res) => {
  if (req.query.product_id) {
    const product_id = req.query.product_id;
    try {
      const product = await p_contract.methods.getProduct(product_id).call();
      const all_company_length = await p_contract.methods
        .getProductOwnerLength(product_id)
        .call();
      const companies = [];
      for (let i = 0; i < all_company_length; i++) {
        const company_address = await p_contract.methods
          .productOwners(product_id, i)
          .call();
        const company = company_deserializer(
          await sc_contract.methods.getCompany(company_address).call()
        );
        companies.push({
          owner: company.owner,
          name: company.name,
        });
      }
      return res.status(200).json({
        message: "product retrieved",
        data: [{ product: product_deserializer(product), companies }],
      });
    } catch (err) {
      if (err.name && err.name === "ContractExecutionError")
        return res.status(400).json({ message: err.innerError.message });
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  if (req.query.company_address && !req.query.filter) {
    try {
      const company = company_deserializer(
        await sc_contract.methods.getCompany(req.query.company_address).call()
      );
      const response = await Promise.all(
        company.listOfSupply.map(async (product_id) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(product_id).call()
          );
          let supply;
          try {
            supply = supply_deserializer(
              await sc_contract.methods
                .getSupply(product_id)
                .call({ from: req.query.company_address })
            );
          } catch (err) {
            supply = {
              total: 0,
              supplyId: [],
              quantities: [],
            };
          }
          return {
            ...product,
            ...supply,
          };
        })
      );
      return res.status(200).json({
        message: "successfully obtained all company product details",
        data: [response],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const all_product_length = await p_contract.methods
      .getProductLength()
      .call();
    const products = [];
    for (let i = 0; i < all_product_length; i++) {
      products.push(
        product_deserializer(await p_contract.methods.products(i).call())
      );
    }
    let my_product;
    if (req.query.filter && req.query.company_address) {
      const company = company_deserializer(
        await sc_contract.methods.getCompany(req.query.company_address).call()
      );
      my_product = company.listOfSupply;
    }
    if (req.query.has_recipe === "false") {
      if (my_product)
        return res.status(200).json({
          message: "all product that has no recipe retrieved",
          data: [
            products.filter(
              (product) =>
                !product.has_recipe &&
                !my_product.some((my) => my === product.productId)
            ),
          ],
        });
      return res.status(200).json({
        message: "all product that has no recipe retrieved",
        data: [products.filter((product) => !product.has_recipe)],
      });
    }
    if (req.query.has_recipe) {
      if (my_product)
        return res.status(200).json({
          message: "all product that has no recipe retrieved",
          data: [
            products.filter(
              (product) =>
                product.has_recipe &&
                !my_product.some((my) => my === product.productId)
            ),
          ],
        });
      return res.status(200).json({
        message: "all product that has recipe retrieved",
        data: [products.filter((product) => product.has_recipe)],
      });
    }
    return res.status(200).json({
      message: "all product retrieved",
      data: [products],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/recipe", token_verification, async (req, res) => {
  if (!req.query.product_id)
    return res.status(400).json({
      message: "product ID does not exist in query",
    });
  try {
    const recipes = recipe_deserializer(
      await p_contract.methods
        .getRecipe(req.query.product_id)
        .call({ from: req.wallet_address })
    );
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const response = await Promise.all(
      recipes.prerequisites.map(async (product, idx) => {
        try {
          const supply = supply_deserializer(
            await sc_contract.methods
              .getPrerequisiteSupply(product.productId)
              .call({ from: req.wallet_address })
          );
          const company_product = company.downstream.filter(
            (company_product) => company_product.productId === product.productId
          );
          return {
            product,
            product_owner: company_product,
            inventory_quantity: supply.total,
            recipe_quantity: recipes.quantities[idx],
          };
        } catch (err) {
          return {
            product,
            product_owner: [],
            inventory_quantity: 0,
            recipe_quantity: recipes.quantities[idx],
          };
        }
      })
    );
    const flatten_response = [];
    response.forEach((data) => {
      if (data.product_owner.length > 0) {
        flatten_response.push(
          ...data.product_owner.map((product_owner) => {
            return {
              ...data,
              product_owner,
            };
          })
        );
      } else {
        flatten_response.push({
          ...data,
          product_owner: undefined,
        });
      }
    });
    return res.status(200).json({
      message: "obtained product recipe",
      data: [flatten_response, response],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/my", token_verification, async (req, res) => {
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const response = await Promise.all(
      company.listOfSupply.map(async (product_id) => {
        const product = product_deserializer(
          await p_contract.methods.getProduct(product_id).call()
        );
        let supply;
        try {
          supply = supply_deserializer(
            await sc_contract.methods
              .getSupply(product_id)
              .call({ from: req.wallet_address })
          );
        } catch (err) {
          supply = {
            total: 0,
            supplyId: [],
            quantities: [],
          };
        }
        return {
          ...product,
          ...supply,
        };
      })
    );
    return res.status(200).json({
      message: "successfully obtained all company product details",
      data: [response],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/prerequisite", async (req, res) => {
  if (!req.query.company_address)
    return res.status(400).json({
      message: "company address does not exist in body",
    });
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.query.company_address).call()
    );
    const response = await Promise.all(
      company.downstream.map(async (company_product) => {
        const company_user = await User.findOne({
          wallet_address: company_product.companyId,
        });
        const product = product_deserializer(
          await p_contract.methods.getProduct(company_product.productId).call()
        );
        const supply = supply_deserializer(
          await sc_contract.methods
            .getPrerequisiteSupply(company_product.productId)
            .call({ from: req.query.company_address })
        );
        return {
          owner: `${company_user.company_name} - ${company_user.wallet_address}`,
          ...product,
          ...supply,
        };
      })
    );
    return res.status(200).json({
      message:
        "successfully obtained all prerequisite supply details for a company",
      data: [response],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/prerequisite/my", token_verification, async (req, res) => {
  try {
    const company = company_deserializer(
      await sc_contract.methods.getCompany(req.wallet_address).call()
    );
    const response = await Promise.all(
      company.downstream.map(async (company_product) => {
        const company_user = await User.findOne({
          wallet_address: company_product.companyId,
        });
        const product = product_deserializer(
          await p_contract.methods.getProduct(company_product.productId).call()
        );
        const supply = supply_deserializer(
          await sc_contract.methods
            .getPrerequisiteSupply(company_product.productId)
            .call({ from: req.wallet_address })
        );
        return {
          owner: `${company_user.company_name} - ${company_user.wallet_address}`,
          ...product,
          ...supply,
        };
      })
    );
    return res.status(200).json({
      message:
        "successfully obtained all prerequisite supply details for a company",
      data: [response],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/", token_verification, async (req, res) => {
  if (!req.body.product_name)
    return res.status(400).json({
      message: "product name does not exist in body",
    });
  if (!req.body.prerequisite_supplies)
    return res.status(400).json({
      message: "prerequisite supplies does not exist in body",
    });
  const seen = {};
  const hasDuplicates = req.body.prerequisite_supplies.some(function (
    currentObject
  ) {
    if (seen.hasOwnProperty(currentObject.product_id)) {
      return true;
    }
    return (seen[currentObject.product_id] = false);
  });
  if (hasDuplicates)
    return res.status(400).json({
      message: "please remove any duplicate recipes",
    });
  if (!req.body.quantity_prerequisite_supplies)
    return res.status(400).json({
      message: "quantity prerequisite supplies does not exist in body",
    });
  if (req.query.existing) {
    if (!req.body.product_id)
      return res.status(400).json({
        message: "product ID does not exist in body",
      });
    try {
      const prerequisite_supplies = await Promise.all(
        req.body.prerequisite_supplies.map(async (supply) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(supply.product_id).call()
          );
          return {
            ...product,
            exist: true,
          };
        })
      );
      await p_contract.methods
        .addProductOwnerWithRecipe(
          req.body.product_id,
          prerequisite_supplies,
          req.body.quantity_prerequisite_supplies
        )
        .send({
          from: req.wallet_address,
          gas: "6721975",
        });
      await sc_contract.methods
        .addProductOwner(req.body.product_id, req.body.product_name)
        .send({ from: req.wallet_address, gas: "6721975" });
      await delete_contract.methods
        .addProduct(req.body.product_id, req.wallet_address)
        .send({ from: req.wallet_address, gas: "6721975" });
      const product = await p_contract.methods
        .getProduct(req.body.product_id)
        .call();
      return res.status(200).json({
        message: "product has been created",
        data: [{ ...product_deserializer(product), total: 0 }],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    const prerequisite_supplies = await Promise.all(
      req.body.prerequisite_supplies.map(async (supply) => {
        const product = product_deserializer(
          await p_contract.methods.getProduct(supply.product_id).call()
        );
        return {
          ...product,
          exist: true,
        };
      })
    );
    const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
    await p_contract.methods
      .addProductWithRecipe(
        id,
        req.body.product_name,
        prerequisite_supplies,
        req.body.quantity_prerequisite_supplies
      )
      .send({
        from: req.wallet_address,
        gas: "6721975",
      });
    await sc_contract.methods
      .addProduct(id, req.body.product_name, req.wallet_address)
      .send({ from: req.wallet_address, gas: "6721975" });
    await delete_contract.methods
      .addProduct(id, req.wallet_address)
      .send({ from: req.wallet_address, gas: "6721975" });
    const product = await p_contract.methods.getProduct(id).call();
    return res.status(200).json({
      message: "product has been created",
      data: [{ ...product_deserializer(product), total: 0 }],
    });
  } catch (err) {
    if (err.name && err.name === "ContractExecutionError")
      return res.status(400).json({ message: err.innerError.message });
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/no_recipe", token_verification, async (req, res) => {
  if (req.query.existing) {
    if (!req.body.product_id)
      return res.status(400).json({
        message: "product ID does not exist in body",
      });
    if (!req.body.product_name)
      return res.status(400).json({
        message: "product Name does not exist in body",
      });
    try {
      const find_existing_request = await ProductRequest.find({
        company: req.wallet_address,
      });
      if (find_existing_request.length > 2)
        return res.status(400).json({
          message: "you are limited to 3 product request",
        });
      const request = await ProductRequest.create({
        productId: req.body.product_id,
        productName: req.body.product_name,
        company: req.wallet_address,
        existing: true,
        created_at: new Date(),
        updated_at: new Date(),
        progress: "pending",
      });
      return res.status(200).json({
        message: "successfully requested to add product without recipe",
        data: [request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  if (!req.body.product_name)
    return res.status(400).json({
      message: "product Name does note exist in body",
    });
  try {
    const find_existing_request = await ProductRequest.find({
      company: req.wallet_address,
    });
    if (find_existing_request.length > 2)
      return res.status(400).json({
        message: "you are limited to 3 product request",
      });
    const request = await ProductRequest.create({
      productName: req.body.product_name,
      company: req.wallet_address,
      existing: false,
      created_at: new Date(),
      updated_at: new Date(),
      progress: "pending",
    });
    return res.status(200).json({
      message: "successfully requested to add product without recipe",
      data: [request],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/no_recipe/approve", token_verification, async (req, res) => {
  if (!req.body.product_request_id)
    return res.status(400).json({
      message: "product name does not exist in body",
    });
  if (!req.owner)
    return res.status(403).json({
      message: "only network owners are allowed",
    });
  try {
    const request = await ProductRequest.findById(req.body.product_request_id);
    if (request.progress !== "pending")
      return res.status(400).json({
        message: "request has been processed!",
      });
    if (request.existing) {
      await p_contract.methods
        .addProductOwnerWithoutRecipe(request.productId, request.company)
        .send({ from: req.wallet_address, gas: "6721975" });
      // TODO: change addProductOwner only networkOwner
      await sc_contract.methods
        .addProductOwner(request.productId, request.productName)
        .send({ from: request.company, gas: "6721975" });
      await delete_contract.methods
        .addProduct(request.productId, request.company)
        .send({ from: req.wallet_address, gas: "6721975" });
      request.updated_at = new Date();
      request.progress = "approved";
      request.save();
      return res.status(200).json({
        message: "product has been created",
        data: [],
      });
    }
    const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
    await p_contract.methods
      .addProductWithoutRecipe(id, request.productName, request.company)
      .send({ from: req.wallet_address, gas: "6721975" });
    await sc_contract.methods
      .addProduct(id, request.productName, request.company)
      .send({ from: req.wallet_address, gas: "6721975" });
    await delete_contract.methods
      .addProduct(id, req.company)
      .send({ from: req.wallet_address, gas: "6721975" });
    request.updated_at = new Date();
    request.progress = "approved";
    request.save();
    const product = await p_contract.methods.getProduct(id).call();
    return res.status(200).json({
      message: "product has been created",
      data: [product_deserializer(product)],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/no_recipe/decline", token_verification, async (req, res) => {
  if (!req.body.product_request_id)
    return res.status(400).json({
      message: "product name does not exist in body",
    });
  if (!req.owner)
    return res.status(403).json({
      message: "only network owners are allowed",
    });
  try {
    const request = await ProductRequest.findById(req.body.product_request_id);
    if (request.progress !== "pending")
      return res.status(400).json({
        message: "request has been processed!",
      });
    request.updated_at = new Date();
    request.progress = "declined";
    request.save();
    return res.status(200).json({
      message: "product request has been declined",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/no_recipe", token_verification, async (req, res) => {
  if (req.owner) {
    try {
      let request;
      if (req.query.timeline === "current") {
        request = await ProductRequest.find({
          progress: "pending",
        });
      } else {
        const approved_request = await ProductRequest.find({
          progress: "approved",
        });
        const declined_request = await ProductRequest.find({
          progress: "declined",
        });
        request = approved_request.concat(declined_request);
      }
      return res.status(200).json({
        message: "product request has been retrieved",
        data: [request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
  try {
    let request;
    if (req.query.timeline === "current") {
      request = await ProductRequest.find({
        progress: "pending",
        company: req.wallet_address,
      });
    } else {
      const approved_request = await ProductRequest.find({
        progress: "approved",
        company: req.wallet_address,
      });
      const declined_request = await ProductRequest.find({
        progress: "declined",
        company: req.wallet_address,
      });
      request = approved_request.concat(declined_request);
    }
    return res.status(200).json({
      message: "product request has been retrieved",
      data: [request],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

function create_code() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < 4) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

router.delete("/", token_verification, async (req, res) => {
  if (!req.query.request_id)
    return res.status(400).json({
      message: "request ID does not exist in query",
    });
  if (!req.query.product_id)
    return res.status(400).json({
      message: "product ID does not exist in query",
    });
  if (!req.query.code)
    return res.status(400).json({
      message: "code does not exist in query",
    });
  try {
    const company = company_delete_request_deserializer(
      await delete_contract.methods.getCompany(req.wallet_address).call()
    );
    const upstream_left = company.upstream.filter(
      (company_product) => company_product.productId !== req.query.product_id
    );
    await delete_contract.methods
      .deleteSupply(
        req.query.request_id,
        req.query.product_id,
        upstream_left,
        req.query.code
      )
      .send({ from: req.wallet_address, gas: "6721975" });
    await sc_contract.methods
      .deleteSupply(
        req.query.request_id,
        req.query.product_id,
        upstream_left,
        req.query.code
      )
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "product deleted",
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete_request", token_verification, async (req, res) => {
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  try {
    const id = parseInt(crypto.randomBytes(2).toString("hex"), 16);
    const code = create_code();
    await delete_contract.methods
      .sendDeleteRequest(id, req.body.product_id, code)
      .send({ from: req.wallet_address, gas: "6721975" });
    await sc_contract.methods
      .sendDeleteRequest(id, req.body.product_id, code)
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: `delete request for product ${req.body.product_id} has been sent`,
      data: [],
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete_request/approve", token_verification, async (req, res) => {
  if (!req.body.request_id)
    return res.status(400).json({
      message: "request ID does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (!req.body.code)
    return res.status(400).json({
      message: "code does not exist in body",
    });
  if (!req.body.request_owner)
    return res.status(400).json({
      message: "code does not exist in body",
    });
  try {
    await delete_contract.methods
      .respondDeleteRequest(
        req.body.request_id,
        req.body.product_id,
        req.wallet_address,
        true,
        req.body.code
      )
      .send({ from: req.wallet_address, gas: "6721975" });
    await sc_contract.methods
      .addApproval(req.body.request_id, req.body.code, req.body.request_owner)
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "delete request successfully approved",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.post("/delete_request/decline", token_verification, async (req, res) => {
  if (!req.body.request_id)
    return res.status(400).json({
      message: "request ID does not exist in body",
    });
  if (!req.body.product_id)
    return res.status(400).json({
      message: "product ID does not exist in body",
    });
  if (!req.body.code)
    return res.status(400).json({
      message: "code does not exist in body",
    });
  try {
    await delete_contract.methods
      .respondDeleteRequest(
        req.body.request_id,
        req.body.product_id,
        req.wallet_address,
        false,
        req.body.code
      )
      .send({ from: req.wallet_address, gas: "6721975" });
    return res.status(200).json({
      message: "delete request successfully declined",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
});

router.get("/delete_request/incoming", token_verification, async (req, res) => {
  const { timeline = "current" } = req.query;
  if (timeline === "current") {
    try {
      const company = company_delete_request_deserializer(
        await delete_contract.methods.getCompany(req.wallet_address).call()
      );
      const incoming_request = await Promise.all(
        company.incomingDeleteRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const owner = await User.findOne({
            wallet_address: request.owner,
          });
          return {
            id: request.id,
            product,
            owner,
            code: request.code,
          };
        })
      );
      return res.status(200).json({
        message: "incoming delete requests obtained",
        data: [incoming_request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  } else {
    try {
      const past_delete_requests = delete_request_event_deserializer(
        await sc_contract.getPastEvents("DeleteRequests", {
          filter: { from: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const incoming_request = await Promise.all(
        past_delete_requests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const owner = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            owner,
          };
        })
      );
      return res.status(200).json({
        message: "outgoing delete requests obtained",
        data: [incoming_request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
});

router.get("/delete_request/outgoing", token_verification, async (req, res) => {
  const { timeline = "current" } = req.query;
  if (timeline === "current") {
    try {
      const company = company_delete_request_deserializer(
        await delete_contract.methods.getCompany(req.wallet_address).call()
      );
      const outgoing_request = await Promise.all(
        company.outgoingDeleteRequests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const enough_approval = await delete_contract.methods
            .checkEnoughApproval(request.id)
            .call();
          const owner = await User.findOne({
            wallet_address: request.owner,
          });
          return {
            id: request.id,
            product,
            owner,
            code: request.code,
            enough_approval,
          };
        })
      );
      return res.status(200).json({
        message: "outgoing delete requests obtained",
        data: [outgoing_request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  } else {
    try {
      const past_delete_requests = delete_request_event_deserializer(
        await sc_contract.getPastEvents("DeleteRequests", {
          filter: { from: req.wallet_address },
          fromBlock: 0,
          toBlock: "latest",
        })
      );
      const outgoing_request = await Promise.all(
        past_delete_requests.map(async (request) => {
          const product = product_deserializer(
            await p_contract.methods.getProduct(request.productId).call()
          );
          const owner = await User.findOne({
            wallet_address: request.from,
          });
          return {
            id: request.id,
            product,
            owner,
          };
        })
      );
      return res.status(200).json({
        message: "outgoing delete requests obtained",
        data: [outgoing_request],
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  }
});

module.exports = router;
