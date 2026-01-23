const db = require("../config/db");
const redis = require("../config/redis");
const { isGracePeriodValid } = require("../utils/gracePeriod");
const { getDaysRemaining } = require("../utils/paymentUtils");

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


const PAYMENT_CACHE_KEY = (uid) => `employer:payment:${uid}`;

exports.checkEmployerPaymentStatus = async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(200).json({
      paid: false,
      days_remaining: 0,
      reason: "INVALID_UID",
    });
  }

  try {
    /* 🔹 Redis first */
    try {
      const cached = await redis.get(PAYMENT_CACHE_KEY(uid));
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e) {
      console.warn("Redis GET failed:", e.message);
    }

    /* 🔹 Fetch employer */
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
        paid: false,
        days_remaining: 0,
        reason: "EMPLOYER_NOT_FOUND",
      };
    }

    /* ❌ Never paid */
    else if (!rows[0].mpesa_receipt || !rows[0].payment_date) {
      response = {
        paid: false,
        days_remaining: 0,
        reason: "PAYMENT_REQUIRED",
      };
    }

    /* 🔍 Calculate days remaining */
    else {
      const daysRemaining = getDaysRemaining(rows[0].payment_date, 3);

      /* ⏰ Expired → UPDATE DB FIRST */
      if (daysRemaining === 0) {
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

        /* 🧹 Clear Redis */
        try {
          await redis.del(PAYMENT_CACHE_KEY(uid));
          await redis.del(`employer:access:${uid}`);
        } catch (_) {}

        response = {
          paid: false,
          days_remaining: 0,
          reason: "GRACE_PERIOD_EXPIRED",
        };
      } else {
        response = {
          paid: true,
          days_remaining: daysRemaining,
        };
      }
    }

    /* 🔹 Cache final result */
    try {
      await redis.setEx(
        PAYMENT_CACHE_KEY(uid),
        300, // 5 mins
        JSON.stringify(response)
      );
    } catch (_) {}

    return res.status(200).json(response);
  } catch (error) {
    console.error("Payment status error:", error);
    return res.status(500).json({
      paid: false,
      days_remaining: 0,
      reason: "SERVER_ERROR",
    });
  }
};


exports.selectCandidate = async (req, res) => {
  const { employer_uid, candidate_id } = req.body;

  if (!employer_uid || !candidate_id) {
    return res.status(200).json({
      success: false,
      reason: "MISSING_PARAMS",
    });
  }

  try {
    /* 🔹 1. Get employer info */
    const employerRows = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT uid, name, phone_no, city, county
        FROM yaya_employers
        WHERE uid = ?
        LIMIT 1
        `,
        [employer_uid],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    if (!employerRows.length) {
      return res.status(200).json({
        success: false,
        reason: "EMPLOYER_NOT_FOUND",
      });
    }

    const employer = employerRows[0];

    /* 🔹 2. Check employer selection limit */
    const countRows = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT COUNT(*) AS total
        FROM yaya_candidates
        WHERE employer_uid = ?
        `,
        [employer_uid],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    if (countRows[0].total >= 3) {
      return res.status(200).json({
        success: false,
        reason: "SELECTION_LIMIT_REACHED",
      });
    }

    /* 🔹 3. Check candidate availability */
    const candidateRows = await new Promise((resolve, reject) => {
      db.query(
        `
        SELECT status
        FROM yaya_candidates
        WHERE candidate_id = ?
        LIMIT 1
        `,
        [candidate_id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });

    if (!candidateRows.length) {
      return res.status(200).json({
        success: false,
        reason: "CANDIDATE_NOT_FOUND",
      });
    }

    if (candidateRows[0].status !== "Available") {
      return res.status(200).json({
        success: false,
        reason: "CANDIDATE_UNAVAILABLE",
      });
    }

    /* 🔹 4. Update candidate (atomic) */
    await new Promise((resolve, reject) => {
      db.query(
        `
        UPDATE yaya_candidates
        SET
          employer_uid    = ?,
          employer_name   = ?,
          employer_no     = ?,
          employer_city   = ?,
          employer_county = ?,
          status          = 'Unavailable',
          date_selected   = NOW()
        WHERE candidate_id = ?
          AND status = 'Available'
        `,
        [
          employer.uid,
          employer.name,
          employer.phone_no,
          employer.city,
          employer.county,
          candidate_id,
        ],
        (err, result) => {
          if (err) return reject(err);
          if (result.affectedRows === 0)
            return reject(new Error("RACE_CONDITION"));
          resolve();
        }
      );
    });

    /* 🔹 5. Clear caches */
    try {
      await redis.del(`candidate:${candidate_id}`);
      await redis.del(`employer:candidates:${employer_uid}`);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "Candidate selected successfully",
    });
  } catch (error) {
    console.error("Select candidate error:", error.message);
    return res.status(500).json({
      success: false,
      reason: "SERVER_ERROR",
    });
  }
};