const db = require("../config/db");
const redis = require("../config/redis");
const {
  employerKey,
  candidateKey,
  candidatesAvailableKey,
} = require("../utils/cacheKeys");



exports.selectCandidate = async (req, res) => {
  db.query(
    `
    UPDATE yaya_candidates
    SET status='Selected', date_selected=NOW()
    WHERE candidate_id=? AND status='Available'
    `,
    [req.params.id],
    async (err, result) => {
      if (err || result.affectedRows === 0)
        return res.status(400).json({ message: "Selection failed" });

      await redis.del(candidateKey(req.params.id));
      await redis.del(candidatesAvailableKey());
      res.json({ message: "Candidate selected" });
    }
  );
};


exports.dischargeCandidate = async (req, res) => {
  db.query(
    `
    UPDATE yaya_candidates
    SET status='Discharged', date_discharged=NOW()
    WHERE candidate_id=? AND status='Selected'
    `,
    [req.params.id],
    async (err, result) => {
      if (err || result.affectedRows === 0)
        return res.status(400).json({ message: "Discharge failed" });

      await redis.del(candidateKey(req.params.id));
      await redis.del(candidatesAvailableKey());
      res.json({ message: "Candidate discharged" });
    }
  );
};





exports.deleteEmployer = async (req, res) => {
  const uid = req.params.uid; 
  db.query(
    `DELETE FROM yaya_employer WHERE user_id=?`,
    [uid],
    async (err, result) => {
      if (err) return res.status(500).json({ message: "Delete failed" });
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Employer not found" });

      await redis.del(employerKey(uid));
      res.json({ message: "Employer deleted successfully" });
    }
  );
};





/* ✅ Register Employer */
exports.createEmployer = async (req, res) => {
  const {
    uid,
    name,
    email,
    phone_no,
    city,
    county,
    street_name,
    user_image
  } = req.body;

  console.log(req.body);
  if (!uid || !name || !phone_no)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT IGNORE INTO yaya_employers SET ?`,
        {
          uid,
          name,
          email,
          phone_no,
          city,
          county,
          street_name,
          user_image
        },
        (err) => (err ? reject(err) : resolve())
      );
    });

    res.status(201).json({ message: "Employer registered successfully" });
  } catch (err) {
    console.error("Create employer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ✅ Get Employer */
exports.getEmployer = async (req, res) => {
  const key = employerKey(req.params.uid);

  const cached = await redis.get(key);
  if (cached) return res.json(JSON.parse(cached));

  db.query(
    `SELECT * FROM yaya_employers WHERE uid=?`,
    [req.params.uid],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error" });
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      await redis.setEx(key, 600, JSON.stringify(rows[0]));
      res.json(rows[0]);
    }
  );
};

/* ✅ Update Employer */
exports.updateEmployer = async (req, res) => {
  db.query(
    `UPDATE yaya_employers SET ? WHERE uid=?`,
    [req.body, req.params.uid],
    async (err) => {
      if (err) return res.status(500).json({ message: "Update failed" });
      await redis.del(employerKey(req.params.uid));
      res.json({ message: "Employer updated" });
    }
  );
};
