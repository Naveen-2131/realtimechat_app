const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    updateUserStatus,
    getAllGroups,
    deleteGroup,
    getAllReports,
    updateReportStatus,
    getAnalytics,
    deleteMessage
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/users', protect, admin, getAllUsers);
router.put('/users/:id/status', protect, admin, updateUserStatus);
router.get('/groups', protect, admin, getAllGroups);
router.delete('/groups/:id', protect, admin, deleteGroup);
router.get('/reports', protect, admin, getAllReports);
router.put('/reports/:id', protect, admin, updateReportStatus);
router.get('/analytics', protect, admin, getAnalytics);
router.delete('/messages/:id', protect, admin, deleteMessage);

module.exports = router;
