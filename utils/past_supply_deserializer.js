module.exports = (past_supply) => {
  return {
    pastSupply: past_supply.map((id) => Number(id)),
  };
};
