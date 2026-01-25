const db = require("../config/db");
const redis = require("../config/redis");

const ACCESS_KEY = (uid) => `employer:access:${uid}`;

exports.checkEmployerAccessAndStatus = async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(200).json({
      allowed: false,
      paid: false,
      days_remaining: 0,
      reason: "INVALID_UID"
    });
  }

  /* 🔹 Redis first */
  try {
    const cached = await redis.get(ACCESS_KEY(uid));
    if (cached) return res.status(200).json(JSON.parse(cached));
  } catch (_) {}

  db.query(
    `
    SELECT 
      mpesa_receipt,
      payment_date,
      access_expires_at
    FROM yaya_employers
    WHERE uid = ?
    LIMIT 1
    `,
    [uid],
    async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB_ERROR" });
      }

      let response;

      if (!rows.length) {
        response = {
          allowed: false,
          paid: false,
          days_remaining: 0,
          reason: "EMPLOYER_NOT_FOUND"
        };
      } 
      else if (!rows[0].access_expires_at) {
        response = {
          allowed: false,
          paid: false,
          days_remaining: 0,
          reason: "PAYMENT_REQUIRED"
        };
      } 
      else {
        const now = new Date();
        const expiry = new Date(rows[0].access_expires_at);

        if (expiry <= now) {
          /* 🔥 Auto-expire */
          await new Promise((resolve) =>
            db.query(
              `
              UPDATE yaya_employers
              SET mpesa_receipt = NULL,
                  payment_date = NULL,
                  access_expires_at = NULL
              WHERE uid = ?
              `,
              [uid],
              () => resolve()
            )
          );

          response = {
            allowed: false,
            paid: false,
            days_remaining: 0,
            reason: "ACCESS_EXPIRED"
          };
        } else {
          const diffMs = expiry - now;
          const daysRemaining = Math.ceil(
            diffMs / (1000 * 60 * 60 * 24)
          );

          response = {
            allowed: true,
            paid: true,
            days_remaining: daysRemaining
          };
        }
      }

      /* 🔹 Cache */
      try {
        await redis.setEx(
          ACCESS_KEY(uid),
          300,
          JSON.stringify(response)
        );
      } catch (_) {}

      return res.status(200).json(response);
    }
  );
};
