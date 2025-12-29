const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
    const requiredVars = {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
    };

    const missingVars = Object.entries(requiredVars)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        console.error('❌ Cloudinary Configuration Error:');
        console.error(`Missing environment variables: ${missingVars.join(', ')}`);
        console.error('Please set these variables in your .env file or deployment platform.');
        console.error('File uploads will NOT work until Cloudinary is properly configured.');
        return false;
    }

    console.log('✅ Cloudinary configuration validated successfully');
    return true;
};

const isConfigured = validateCloudinaryConfig();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        if (!isConfigured) {
            throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
        }

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

module.exports = { cloudinary, storage, isConfigured };

