module.exports = (request) => {
  return {
    id: Number(request.id),
    from: request.from,
    to: request.to,
    productId: Number(request.productId),
    quantity: Number(request.quantity),
  };
};
