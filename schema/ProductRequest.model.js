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

const product_request_schema = new Schema({
  productId: {
    type: Number,
  },
  productName: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  existing: {
    type: Boolean,
    required: true,
  },
  progress: {
    type: String,
    enum: ["pending", "approved", "declined"],
    required: true,
  },
  created_at: {
    type: Date,
    required: true,
  },
  updated_at: {
    type: Date,
    required: true,
  },
});

product_request_schema.set("toJSON");

module.exports = mongoose.model("ProductRequest", product_request_schema);
