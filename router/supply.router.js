const express = require("express");
const router = express.Router();
const Supply = require("../schema/Supply.model");

router.get("/", async (req, res) => {
  const supply = await Supply.find();
  res.send("supply");
});

module.exports = router;
