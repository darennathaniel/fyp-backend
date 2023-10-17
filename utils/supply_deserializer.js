module.exports = (supply) => {
  return {
    total: Number(supply.total),
    supplyId: supply.supplyId.map((id) => Number(id)),
    quantities: supply.quantities.map((quantity) => Number(quantity)),
    exist: supply.exist,
  };
};
