const product_deserializer = require("./product_deserializer");
const company_product_deserializer = require("./company_product_deserializer");
const company_contract_deserializer = require("./company_contract_deserializer");
const request_deserializer = require("./request_deserializer");
const recipe_deserializer = require("./recipe_deserializer");

module.exports = (company) => {
  return {
    owner: company.owner,
    name: company.name,
    listOfSupply: company.listOfSupply.map((supply) => {
      return product_deserializer(supply);
    }),
    listOfPrerequisites: company.listOfPrerequisites.map((supply) => {
      return product_deserializer(supply);
    }),
    recipes: company.recipes.map((recipe) => {
      return recipe_deserializer(recipe);
    }),
    upstream: company.upstream,
    downstream: company.downstream.map((downstream) => {
      return company_product_deserializer(downstream);
    }),
    incomingRequests: company.incomingRequests.map((request) => {
      return request_deserializer(request);
    }),
    outgoingRequests: company.outgoingRequests.map((request) => {
      return request_deserializer(request);
    }),
    incomingContract: company.incomingContract.map((contract) => {
      return company_contract_deserializer(contract);
    }),
    outgoingContract: company.outgoingContract.map((contract) => {
      return company_contract_deserializer(contract);
    }),
  };
};
