const router = require("express").Router();
const controller = require("../controllers/bureau.controller");

router.post("/register", controller.createBureau);
router.get("/get-bureau/:user_id", controller.getBureau);
router.put("/:user_id", controller.updateBureau);

module.exports = router;
