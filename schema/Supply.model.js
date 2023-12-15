const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const dotenv = require("dotenv").config();
const url = `mongodb+srv://${dotenv.parsed.MONGO_DB_USERNAME}:${dotenv.parsed.MONGO_DB_PASSWORD}@supplychaindapp.rk5tnph.mongodb.net/SupplyChainApp?retryWrites=true&w=majority`;

mongoose
  .connect(url)
  .then(() => {
    console.log("connected to database!");
  })
  .catch((err) => console.log(err));

const supply_schema = new Schema({
  supplyId: {
    type: Number,
    required: true,
  },
  productId: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  quantity_left: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
});

supply_schema.set("toJSON");

module.exports = mongoose.model("Supply", supply_schema);
