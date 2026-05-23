import cloudinary from '../config/cloudinary.js';

const BANNER_FOLDER = 'fashion-store/banners';

export const getBanners = async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: BANNER_FOLDER,
      max_results: 50,
    });

    const banners = result.resources
      .sort((a, b) => a.public_id.localeCompare(b.public_id))
      .map((item) => ({
        public_id: item.public_id,
        image_url: item.secure_url,
        width: item.width,
        height: item.height,
        format: item.format,
        created_at: item.created_at,
      }));

    return res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error('Get banners error:', error);

    return res.status(500).json({
      success: false,
      message: 'Can not get banners from Cloudinary',
    });
  }
};