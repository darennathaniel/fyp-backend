module.exports = (product) => {
  return {
    productId: Number(product.productId),
    productName: product.productName,
  };
};
