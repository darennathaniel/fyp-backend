const company_product_deserializer = require("./company_product_deserializer");
const company_contract_deserializer = require("./company_contract_deserializer");
const request_deserializer = require("./request_deserializer");
const delete_request_deserializer = require("./delete_request_deserializer");

module.exports = (company) => {
  return {
    owner: company.owner,
    name: company.name,
    listOfSupply: company.listOfSupply.map((id) => Number(id)),
    listOfPrerequisites: company.listOfPrerequisites.map((id) => Number(id)),
    upstream: company.upstream.map((upstream) => {
      return company_product_deserializer(upstream);
    }),
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
    incomingDeleteRequests: company.incomingDeleteRequests.map(
      (delete_request) => {
        return delete_request_deserializer(delete_request);
      }
    ),
    outgoingDeleteRequests: company.outgoingDeleteRequests.map(
      (delete_request) => {
        return delete_request_deserializer(delete_request);
      }
    ),
  };
};
