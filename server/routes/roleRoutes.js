const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleController = require('../controllers/roleController');

// Public for authenticated users: fetch roadmap/details of a role
router.get('/:roleId/roadmap', auth, roleController.getRoleRoadmap);

module.exports = router;
