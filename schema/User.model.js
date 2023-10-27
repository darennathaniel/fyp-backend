const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const dotenv = require("dotenv").config();
const url = `mongodb+srv://${dotenv.parsed.MONGO_DB_USERNAME}:${dotenv.parsed.MONGO_DB_PASSWORD}@supplychaindapp.rk5tnph.mongodb.net/SupplyChainApp?retryWrites=true&w=majority`;

mongoose
  .connect(url)
  .then(() => {
    console.log("connected to database!");
  })
  .catch((err) => console.log(err.response));

const user_schema = new Schema({
  username: {
    type: String,
    unique: true,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  wallet_address: {
    type: String,
    required: true,
    unique: true,
  },
  is_owner: {
    type: Boolean,
    required: true,
  },
  display_name: {
    type: String,
    required: true,
  },
});

user_schema.set("toJSON");

module.exports = mongoose.model("User", user_schema);
