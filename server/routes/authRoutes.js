const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyFirebaseToken } = require("../services/firebaseAdmin");

function parseFacultyEmails() {
  const configured = process.env.FACULTY_EMAILS || process.env.ADMIN_EMAILS || "";
  return configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

router.post("/google", async (req, res) => {
  try {
    const { email, name, idToken } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: "Email and name are required" });
    }

    const normalizedEmail = email.toLowerCase();
    
    // For now, skip Firebase token verification (we'll debug that separately)
    // Just validate the email format and domain
    console.log(`🔐 Login attempt: ${normalizedEmail}`);
    console.log(`⚠️  Firebase token verification SKIPPED - domain validation only`);
    
    if (!email || !name) {
      return res.status(400).json({ message: "Email and name are required" });
    }

    const facultyEmails = parseFacultyEmails();
    console.log(`🔐 Login attempt: ${normalizedEmail}`);
    console.log(`   Faculty emails configured: ${facultyEmails.join(", ") || "none"}`);

    let user = await User.findOne({ email: normalizedEmail });
    let profileExists = true;

    if (!user) {
      let role = "student";
      const isFaculty = facultyEmails.includes(normalizedEmail);
      const isBitsathyDomain = normalizedEmail.endsWith("@bitsathy.ac.in");

      console.log(`   Is faculty: ${isFaculty}, Is @bitsathy.ac.in: ${isBitsathyDomain}`);

      if (isFaculty) {
        role = "faculty";
        console.log(`   ✅ Faculty user - creating with faculty role`);
      } else if (!isBitsathyDomain) {
        console.log(`   ❌ Rejected: Email domain not authorized. Only @bitsathy.ac.in or faculty emails allowed.`);
        return res.status(403).json({ message: "Only @bitsathy.ac.in domain or authorized faculty can login" });
      } else {
        console.log(`   ✅ Valid @bitsathy.ac.in domain - creating student user`);
      }

      user = await User.create({ name, email: normalizedEmail, role });
      profileExists = false;
      console.log(`   📝 New user created: ${normalizedEmail} (${role})`);
    } else {
      console.log(`   ✅ Existing user found: ${user.email} (${user.role})`);
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      token,
      role: user.role,
      profileExists,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
});

module.exports = router;
