export type ExportSections = {
  task1Prompt?: string;
  task1ImageUrl?: string | null;
  task1ImageWidth?: number;
  task1ImageHeight?: number;
  task1Answer?: string;
  task2Prompt?: string;
  task2Answer?: string;
  teacherComment?: string;
};

/**
 * Word chặn tự động tải ảnh từ URL ngoài khi mở file .doc (giống cách Outlook chặn ảnh từ xa
 * trong email HTML) — ảnh Task 1 sẽ hiện icon lỗi thay vì hình thật. Để khắc phục, ta tải ảnh về
 * và nhúng thẳng dạng base64 (data URI) vào file, giúp ảnh luôn hiển thị được mà không cần mạng.
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Word không tin cậy CSS max-width/max-height khi convert file .doc — nó thường lấy kích thước
 * gốc (pixel thật) của ảnh, khiến ảnh bị phóng to sai tỉ lệ khi bấm "Enable Editing". Để tránh việc
 * này, ta đo trước kích thước gốc, tính lại theo tỉ lệ (giới hạn maxWidth/maxHeight) rồi gán thẳng
 * thuộc tính width/height (px) vào thẻ <img> — Word tôn trọng thuộc tính này hơn CSS.
 */
async function loadImageForDoc(
  url: string,
  maxWidth = 500,
  maxHeight = 350,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const dataUrl = await imageUrlToBase64(url);
  if (!dataUrl) return null;

  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Không đọc được kích thước ảnh"));
      img.src = dataUrl;
    });

    let { width, height } = size;
    if (width > 0 && height > 0) {
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    } else {
      width = maxWidth;
      height = maxHeight;
    }

    return { dataUrl, width, height };
  } catch {
    // Không đo được kích thước (ảnh lỗi định dạng...) — vẫn giữ ảnh với kích thước mặc định thay vì mất ảnh
    return { dataUrl, width: maxWidth, height: maxHeight };
  }
}

/** Trả về bản sao sections với task1ImageUrl đã chuyển sang base64 + kích thước đã tính theo tỉ lệ
 * (nếu tải/đo được), giữ nguyên URL cũ nếu lỗi. cache (tuỳ chọn) giúp tránh tải lại cùng 1 ảnh nhiều
 * lần khi export hàng loạt (nhiều học sinh chung 1 đề thi). */
export async function resolveSectionsImage(
  sections: ExportSections,
  cache?: Map<string, { dataUrl: string; width: number; height: number }>,
): Promise<ExportSections> {
  if (!sections.task1ImageUrl) return sections;
  const url = sections.task1ImageUrl;

  const cached = cache?.get(url);
  if (cached) {
    return { ...sections, task1ImageUrl: cached.dataUrl, task1ImageWidth: cached.width, task1ImageHeight: cached.height };
  }

  const result = await loadImageForDoc(url);
  if (!result) return sections;

  cache?.set(url, result);
  return { ...sections, task1ImageUrl: result.dataUrl, task1ImageWidth: result.width, task1ImageHeight: result.height };
}
