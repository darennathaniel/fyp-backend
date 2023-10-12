const product_deserializer = require("./product_deserializer");

module.exports = (recipe) => {
  return {
    supply: product_deserializer(recipe.supply),
    prerequisites: recipe.prerequisites.map((prerequisite) => {
      return product_deserializer(prerequisite);
    }),
    quantities: recipe.quantities.map((quantity) => {
      return Number(quantity);
    }),
  };
};
