const Domain = require("../models/Domain");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.createDomain = async (req, res) => {
  try {
    const { name, description } = req.body;
    const facultyId = req.user.id;

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      return res.status(400).json({ message: "name is required" });
    }

    const existing = await Domain.findOne({
      name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: "i" },
    });
    if (existing) {
      return res.status(400).json({ message: "Domain with this name already exists" });
    }

    const domain = await Domain.create({
      name: normalizedName,
      description: description || "",
      createdBy: facultyId,
    });

    return res.status(201).json({ message: "Domain created successfully", domain });
  } catch (error) {
    console.error("Create domain error:", error);
    return res.status(500).json({ message: "Failed to create domain" });
  }
};

exports.getAllDomains = async (req, res) => {
  try {
    const domains = await Domain.find()
      .populate("createdBy", "name email")
      .sort({ name: 1 });

    return res.json({ count: domains.length, domains });
  } catch (error) {
    console.error("Fetch domains error:", error);
    return res.status(500).json({ message: "Failed to fetch domains" });
  }
};

exports.deleteDomain = async (req, res) => {
  try {
    const { domainId } = req.params;
    const deleted = await Domain.findByIdAndDelete(domainId);

    if (!deleted) {
      return res.status(404).json({ message: "Domain not found" });
    }

    return res.json({ message: "Domain deleted successfully", domain: deleted });
  } catch (error) {
    console.error("Delete domain error:", error);
    return res.status(500).json({ message: "Failed to delete domain" });
  }
};
