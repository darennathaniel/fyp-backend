module.exports = (company_contract) => {
  return {
    id: company_contract.id,
    productId: Number(company_contract.productId),
    from: company_contract.from,
    to: company_contract.to,
  };
};
