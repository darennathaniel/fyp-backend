module.exports = (delete_request) => {
  return {
    id: Number(delete_request.id),
    approvals: Number(delete_request.approvals),
    code: delete_request.code,
  };
};
