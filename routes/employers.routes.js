const express = require("express");
const router = express.Router();
const {
  createEmployer,
  getEmployer,
  updateEmployer,
  deleteEmployer,
  selectCandidate,
  dischargeCandidate,
} = require("../controllers/employers.controller");

router.post("/register",  createEmployer);
router.get("/:uid",  getEmployer);
router.put("/:uid",  updateEmployer);
router.delete("/:uid",  deleteEmployer);

router.post("/select/:id",  selectCandidate);
router.post("/discharge/:id",  dischargeCandidate);

module.exports = router;
