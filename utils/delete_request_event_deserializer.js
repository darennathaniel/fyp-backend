module.exports = (events) => {
  return events.map((data) => {
    const event = data.returnValues;
    return {
      requestId: Number(event.requestId),
      productId: Number(event.productId),
      from: event.from,
      state: Number(event.state) === 1 ? "rejected" : "approved",
      timestamp: new Date(Number(event.timestamp) * 1000),
    };
  });
};
