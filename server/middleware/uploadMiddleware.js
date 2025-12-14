/* server/middleware/uploadMiddleware.js */
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat-app-uploads', // Folder name in Cloudinary
    resource_type: 'auto', // Auto-detect image/video/raw
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'pdf', 'doc', 'docx', 'txt'],
  },
});

// Check file type (Client-side validation fallback)
function checkFileType(file, cb) {
  const allowedMimetypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
    'video/mp4', 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimetypes.includes(file.mimetype)) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Invalid file type!'));
  }
}

// Init upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).any(); // Accept any field

// Middleware wrapper
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Upload Error:', err);
      // Ensure error is a string
      const message = err.message || typeof err === 'string' ? err : 'Unknown upload error';
      return res.status(400).json({ message });
    }

    // IMPORTANT: Cloudinary returns `path` as the secure URL
    // We map it to satisfy your controller's expectation of `req.file`
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
      req.file.path = req.files[0].path; // Cloudinary URL
    }

    next();
  });
};

module.exports = uploadMiddleware;
