module.exports = (product) => {
  return {
    productId: Number(product.productId),
    productName: product.productName,
    has_recipe: product.has_recipe,
  };
};
