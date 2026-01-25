const router = require("express").Router();
const { checkEmployerAccessAndStatus,selectCandidate} = require("../controllers/employerAccess.controller");

// router.get("/:uid", checkEmployerAccess);
router.get(
  "/payment-status/:uid",
  checkEmployerAccessAndStatus
);

router.post("/select", selectCandidate);


module.exports = router;
