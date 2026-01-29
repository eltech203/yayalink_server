const express = require("express");
const router = express.Router();
const { getNotifications,markNotificationRead } = require("../controllers/notification.controller");

router.get("/notifications/:uid", getNotifications);
router.put("/notifications/read/:id", markNotificationRead);

module.exports = router;
