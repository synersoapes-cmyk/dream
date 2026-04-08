export const validateImageFile = (
  file: File
): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: '仅支持 JPG、PNG、WEBP 格式图片' };
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '图片大小不能超过 10MB' };
  }

  return { valid: true };
};
