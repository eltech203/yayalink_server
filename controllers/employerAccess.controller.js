const db = require("../config/db");
const redis = require("../config/redis");
const { isGracePeriodValid } = require("../utils/gracePeriod");

const accessKey = (uid) => `employer:access:${uid}`;

exports.checkEmployerAccess = async (req, res) => {
  const { uid } = req.params;

  /* 🔴 Guard */
  if (!uid) {
    return res.status(200).json({
      allowed: false,
      reason: "INVALID_UID",
    });
  }

  try {
    /* 🔹 1. Redis first */
    try {
      const cached = await redis.get(accessKey(uid));
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (redisErr) {
      console.warn("Redis GET failed:", redisErr.message);
    }

    /* 🔹 2. Fetch from DB */
    const rows = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT mpesa_receipt, payment_date
        FROM yaya_employers
        WHERE uid = ?
        LIMIT 1
        `,
        [uid],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    let response;

    /* ❌ Employer not found */
    if (!rows || rows.length === 0) {
      response = {
        allowed: false,
        reason: "EMPLOYER_NOT_FOUND",
      };
    }

    /* ❌ Payment not made */
    else if (!rows[0].mpesa_receipt || !rows[0].payment_date) {
      response = {
        allowed: false,
        reason: "PAYMENT_REQUIRED",
      };
    }

    /* ⏰ Grace period expired → revoke & update */
    else if (!isGracePeriodValid(rows[0].payment_date)) {
      console.log("⏰ Grace period expired. Revoking access for:", uid);

      /* 🔥 Expire payment in DB (AWAITED) */
      try {
        await new Promise((resolve, reject) => {
          db.query(
            `
            UPDATE yaya_employers
            SET mpesa_receipt = NULL,
                payment_date = NULL
            WHERE uid = ?
            `,
            [uid],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      } catch (updateErr) {
        console.error("Failed to expire employer payment:", updateErr);
      }

      /* 🧹 Clear Redis */
      try {
        await redis.del(accessKey(uid));
        await redis.del(`employer:${uid}`);
      } catch (redisErr) {
        console.warn("Redis DEL failed:", redisErr.message);
      }

      response = {
        allowed: false,
        reason: "GRACE_PERIOD_EXPIRED",
      };
    }

    /* ✅ Access allowed */
    else {
      response = { allowed: true };
    }

    /* 🔹 3. Cache response */
    try {
      await redis.setEx(
        accessKey(uid),
        300, // 5 minutes
        JSON.stringify(response)
      );
    } catch (redisErr) {
      console.warn("Redis SET failed:", redisErr.message);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Employer access fatal error:", error);
    return res.status(500).json({
      allowed: false,
      reason: "SERVER_ERROR",
    });
  }
};
