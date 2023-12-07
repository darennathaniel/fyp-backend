module.exports = (events) => {
  return events.map((data) => {
    const event = data.returnValues;
    return {
      requestId: Number(event.requestId),
      contractId: Number(event.contractId),
      from: event.from,
      to: event.to,
      productId: Number(event.productId),
      quantity: Number(event.quantity),
      state: Number(event.state) === 1 ? "rejected" : "approved",
      timestamp: new Date(Number(event.timestamp) * 1000),
    };
  });
};
