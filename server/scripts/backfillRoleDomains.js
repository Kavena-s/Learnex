/**
 * Backfill missing role domains using configured domains and legacy interest data.
 * Run: node scripts/backfillRoleDomains.js
 * Dry run: node scripts/backfillRoleDomains.js --dry-run
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Role = require("../models/Role");
const Domain = require("../models/Domain");
require("../models/Interest");

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/student-recommendation";
const isDryRun = process.argv.includes("--dry-run");

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function buildDomainLookup(domains) {
  const lookup = new Map();
  domains.forEach((domain) => {
    const key = normalizeKey(domain.name);
    if (key) {
      lookup.set(key, domain.name);
    }
  });
  return lookup;
}

function findConfiguredDomainMatch(value, domainLookup) {
  const normalizedValue = normalizeKey(value);
  if (!normalizedValue) {
    return null;
  }

  if (domainLookup.has(normalizedValue)) {
    return domainLookup.get(normalizedValue);
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const [key, canonicalName] of domainLookup.entries()) {
    if (!key) continue;
    if (normalizedValue.includes(key) || key.includes(normalizedValue)) {
      const score = Math.min(key.length, normalizedValue.length);
      if (score > bestScore) {
        bestMatch = canonicalName;
        bestScore = score;
      }
    }
  }

  return bestMatch;
}

function resolveDomain(role, domainLookup) {
  const explicitDomain = normalizeText(role.domain);
  if (explicitDomain && normalizeKey(explicitDomain) !== "unspecified") {
    return findConfiguredDomainMatch(explicitDomain, domainLookup) || explicitDomain;
  }

  const interestNames = (role.relatedInterests || [])
    .map((interest) => normalizeText(interest?.name))
    .filter(Boolean);

  for (const interestName of interestNames) {
    const configuredMatch = findConfiguredDomainMatch(interestName, domainLookup);
    if (configuredMatch) {
      return configuredMatch;
    }
  }

  const roleNameMatch = findConfiguredDomainMatch(role.roleName, domainLookup);
  if (roleNameMatch) {
    return roleNameMatch;
  }

  if (interestNames.length > 0) {
    return interestNames[0];
  }

  return roleNameMatch || "";
}

async function backfillRoleDomains() {
  try {
    await mongoose.connect(MONGODB_URI);

    const [domains, roles] = await Promise.all([
      Domain.find().select("name").lean(),
      Role.find()
        .populate("relatedInterests", "name")
        .sort({ roleName: 1 }),
    ]);

    const domainLookup = buildDomainLookup(domains);
    const updates = [];
    const unresolved = [];

    for (const role of roles) {
      const currentDomain = normalizeText(role.domain);
      const resolvedDomain = resolveDomain(role, domainLookup);

      if (resolvedDomain && normalizeKey(resolvedDomain) !== normalizeKey(currentDomain)) {
        updates.push({
          roleId: role._id,
          roleName: role.roleName,
          previousDomain: currentDomain || "<empty>",
          nextDomain: resolvedDomain,
        });

        if (!isDryRun) {
          role.domain = resolvedDomain;
          await role.save();
        }

        continue;
      }

      if (!currentDomain || normalizeKey(currentDomain) === "unspecified") {
        unresolved.push({
          roleId: role._id,
          roleName: role.roleName,
          currentDomain: currentDomain || "<empty>",
        });
      }
    }

    console.log(`\nRole domain backfill ${isDryRun ? "preview" : "complete"}`);
    console.log(`Configured domains: ${domains.length}`);
    console.log(`Roles checked: ${roles.length}`);
    console.log(`Roles ${isDryRun ? "that would be updated" : "updated"}: ${updates.length}`);

    if (updates.length > 0) {
      console.log("\nUpdated roles:");
      updates.forEach((entry) => {
        console.log(`- ${entry.roleName}: ${entry.previousDomain} -> ${entry.nextDomain}`);
      });
    }

    if (unresolved.length > 0) {
      console.log("\nRoles still needing manual review:");
      unresolved.forEach((entry) => {
        console.log(`- ${entry.roleName}: ${entry.currentDomain}`);
      });
    }

    if (isDryRun) {
      console.log("\nDry run only. Re-run without --dry-run to persist changes.");
    }

    if (!updates.length && !unresolved.length) {
      console.log("\nNo role domains needed changes.");
    }
  } catch (error) {
    console.error("Role domain backfill error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

backfillRoleDomains();