const db = require("../config/db");
const redis = require("../config/redis");
const { isGracePeriodValid } = require("../utils/gracePeriod");

const accessKey = (uid) => `employer:access:${uid}`;

exports.checkEmployerAccess = async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(200).json({
      allowed: false,
      reason: "INVALID_UID"
    });
  }

  try {
    /* 🔹 Try Redis */
    let cached;
    try {
      cached = await redis.get(accessKey(uid));
    } catch (redisErr) {
      console.warn("Redis GET failed:", redisErr.message);
    }

    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    /* 🔹 DB Query */
    db.query(
      `SELECT mpesa_receipt, payment_date FROM yaya_employers WHERE uid = ? LIMIT 1`,
      [uid],
      async (err, rows) => {
        if (err) {
          console.error("DB error:", err);
          return res.status(500).json({ message: "DB error" });
        }

        let response;

        if (!rows || rows.length === 0) {
          response = {
            allowed: false,
            reason: "EMPLOYER_NOT_FOUND"
          };
        } else if (!rows[0].mpesa_receipt) {
          response = {
            allowed: false,
            reason: "PAYMENT_REQUIRED"
          };
        } else if (!isGracePeriodValid(rows[0].payment_date)) {
          response = {
            allowed: false,
            reason: "GRACE_PERIOD_EXPIRED"
          };
        } else {
          response = { allowed: true };
        }

        /* 🔹 Cache safely */
        try {
          await redis.setEx(
            accessKey(uid),
            300,
            JSON.stringify(response)
          );
        } catch (redisErr) {
          console.warn("Redis SET failed:", redisErr.message);
        }

        return res.status(200).json(response);
      }
    );
  } catch (error) {
    console.error("Employer access fatal error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};