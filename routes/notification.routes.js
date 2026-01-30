const express = require("express");
const router = express.Router();
const { getNotifications } = require("../controllers/notification.controller");

router.get("/get-notifications/:uid", getNotifications);
// router.put("/notifications/read/:id", markNotificationRead);

module.exports = router;
