const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Determine folder based on route or generic 'chat_uploads'
        const folder = 'chat_uploads';

        // Determine resource type based on mimetype
        let resource_type = 'auto';
        if (file.mimetype.startsWith('image/')) resource_type = 'image';
        if (file.mimetype.startsWith('video/')) resource_type = 'video';
        if (file.mimetype.startsWith('application/pdf')) resource_type = 'raw';

        return {
            folder: folder,
            resource_type: resource_type,
            public_id: Date.now() + '-' + file.originalname.split('.')[0],
            format: undefined, // Let cloudinary handle format
        };
    },
});

module.exports = { cloudinary, storage };
