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
router.get("/get-employer/:uid",  getEmployer);
router.put("/update-employer/:uid",  updateEmployer);
router.delete("/delete-employer/:uid",  deleteEmployer);

router.post("/select/:id",  selectCandidate);
router.post("/discharge/:id",  dischargeCandidate);

module.exports = router;
