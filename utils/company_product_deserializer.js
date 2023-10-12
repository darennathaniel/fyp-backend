module.exports = (company_product) => {
  return {
    companyId: company_product.companyId,
    productId: Number(company_product.productId),
  };
};
