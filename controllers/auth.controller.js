const db = require("../config/db");
const redis = require("../config/redis");
const { userKey } = require("../utils/cacheKeys");

exports.syncUser = (req, res) => {
  const { uid, email, name, phone_no, user_state } = req.body;

  const sql = `
    INSERT INTO yaya_users (uid,email,name,phone_no,user_state)
    VALUES (?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      email=VALUES(email),
      name=VALUES(name),
      phone_no=VALUES(phone_no),
      user_state=VALUES(user_state)
  `;

  db.query(sql, [uid, email, name, phone_no, user_state], async (err) => {
    if (err) return res.status(500).json({ message: "DB error" });

    await redis.del(userKey(uid)); // invalidate cache
    res.json({ message: "User synced" });
  });
};
