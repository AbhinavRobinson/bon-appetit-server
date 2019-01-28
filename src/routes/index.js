const express = require("express");
const router = express.Router();

router.get("/", (req, res, next) => {
  return res.status(200).send({
    message: "UHUL! The API is UP && RUNNING!"
  });
});

router.use("/restaurant", require("./restaurant"));
router.use("/populate", require("./populate-db"));
router.use("/review", require("./review"));
router.use("/event", require("./event"));
router.use("/dish", require("./dish"));
router.use("/home", require("./home"));

module.exports = router;
