module.exports = (events) => {
  return events.map((data) => {
    const event = data.returnValues;
    return {
      requestId: Number(event.requestId),
      owner: event.owner,
      responder: event.responder,
      productId: Number(event.productId),
      state: Number(event.state) === 1 ? "rejected" : "approved",
      timestamp: new Date(Number(event.timestamp) * 1000),
    };
  });
};
