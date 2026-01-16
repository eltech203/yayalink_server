const router = require("express").Router();
const { checkEmployerAccess } = require("../controllers/employerAccess.controller");

router.get("/:uid", checkEmployerAccess);

module.exports = router;
