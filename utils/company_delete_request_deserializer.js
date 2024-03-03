const company_product_deserializer = require("./company_product_deserializer");
const delete_request_deserializer = require("./delete_request_deserializer");

module.exports = (company) => {
  return {
    listOfSupply: company.listOfSupply.map((id) => Number(id)),
    upstream: company.upstream.map((upstream) => {
      return company_product_deserializer(upstream);
    }),
    incomingDeleteRequests: company.incomingDeleteRequests.map((request) => {
      return delete_request_deserializer(request);
    }),
    outgoingDeleteRequests: company.outgoingDeleteRequests.map((request) => {
      return delete_request_deserializer(request);
    }),
  };
};
