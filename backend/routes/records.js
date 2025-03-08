const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Record = require('../models/Record');

// @route   POST api/records
// @desc    Create a record
router.post('/', auth, async (req, res) => {
    try {
        const newRecord = new Record({
            user: req.user.id,
            data: req.body.data,
            fileName: req.body.fileName
        });

        const record = await newRecord.save();
        res.json(record);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/records
// @desc    Get all records for a user
router.get('/', auth, async (req, res) => {
    try {
        const records = await Record.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router; 