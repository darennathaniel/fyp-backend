module.exports = (delete_request) => {
  return {
    id: Number(delete_request.id),
    owner: delete_request.owner,
    productId: Number(delete_request.productId),
    approvals: delete_request.approvals,
    rejected: delete_request.rejected,
  };
};
