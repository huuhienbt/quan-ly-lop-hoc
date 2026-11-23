export const STUDENT_LOGIN_URL = "https://e-class-vinhlong.vercel.app/dang-nhap";

interface LoginSlip {
  names: readonly string[];
  classroomName: string;
  schoolName: string;
  phone: string;
  temporaryPassword: string;
  expiresAt: string;
}

const localTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
  day: "2-digit", month: "2-digit", year: "numeric", hourCycle: "h23",
});

export function formatLoginSlipExpiry(expiresAt: string) {
  return localTime.format(new Date(expiresAt));
}

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (value: string) => value.replace(/[&<>"']/g, character => entities[character]);
const plainText = (value: string) => value.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, " ").replace(/\s+/g, " ").trim().normalize("NFC");

function wrap(text: string, max: number, lineLimit: number): string[] {
  const lines: string[] = [];
  const units = plainText(text).match(new RegExp(`[^ ]{1,${max}}`, "gu")) ?? [];
  let line = "";
  for (const unit of units) {
    if (Array.from(line + " " + unit).length > max && line) {
      lines.push(line);
      line = unit;
    } else {
      line += (line ? " " : "") + unit;
    }
  }
  if (line) lines.push(line);
  return lines.length > lineLimit
    ? [...lines.slice(0, lineLimit - 1), lines[lineLimit - 1].replace(/.$/u, "…")]
    : lines;
}

const text = (value: string, x: number, y: number, size: number, fill: string, weight = 400, fixedWidth = false) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"${fixedWidth ? ' font-family="monospace"' : ""}>${escapeXml(value)}</text>`;

export function buildParentLoginSlip(slip: LoginSlip, now = Date.now()) {
  const expiry = Date.parse(slip.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) {
    throw new Error("Mật khẩu tạm đã hết hạn. Hãy cấp lại để xuất phiếu mới.");
  }
  if (!/^0[35789][0-9]{8}$/.test(slip.phone) || !/^[0-9]{8}$/.test(slip.temporaryPassword)) {
    throw new Error("Không thể xuất phiếu vì thông tin đăng nhập không hợp lệ.");
  }
  const classLines = wrap(`${slip.classroomName} · ${slip.schoolName}`, 51, 2);
  const nameLines = wrap(slip.names.join(" · "), 43, 5);
  const header = 182 + 34 * classLines.length;
  const credentials = header + 116 + 40 * nameLines.length;
  const steps = credentials + 248;
  const height = steps + 280;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}">
    <rect width="1000" height="${height}" fill="#f5faf8"/>
    <rect x="24" y="24" width="952" height="${height - 48}" rx="34" fill="#fff" stroke="#d5e5df" stroke-width="2"/>
    <rect x="24" y="24" width="952" height="${header - 24}" rx="34" fill="#13584d"/>
    <g font-family="Arial, DejaVu Sans, sans-serif">
      ${text("LỚP HỌC HẠNH PHÚC", 76, 84, 25, "#d5f1e6", 700)}
      ${text("Phiếu đăng nhập học sinh", 76, 151, 50, "#fff", 700)}
      ${classLines.map((line, i) => text(line, 76, 190 + 34 * i, 26, "#e3f6ef")).join("")}
      ${text("HỌC SINH", 76, header + 59, 23, "#416372", 700)}
      ${nameLines.map((line, i) => text(line, 76, header + 101 + 40 * i, 34, "#183f50", 700)).join("")}
      <rect x="76" y="${credentials}" width="414" height="146" rx="21" fill="#eef5fc"/>
      <rect x="510" y="${credentials}" width="414" height="146" rx="21" fill="#def3e9"/>
      ${text("SỐ ĐIỆN THOẠI ĐĂNG NHẬP", 101, credentials + 44, 22, "#355c70", 700)}
      ${text(slip.phone, 101, credentials + 108, 52, "#183f50", 700, true)}
      ${text("MẬT KHẨU TẠM", 535, credentials + 44, 22, "#235d50", 700)}
      ${text(slip.temporaryPassword, 535, credentials + 108, 52, "#13584d", 700, true)}
      ${text("Hạn dùng: " + formatLoginSlipExpiry(slip.expiresAt) + " (giờ Việt Nam)", 76, credentials + 195, 27, "#70470a", 700)}
      <path d="M76 ${steps - 20}H924" stroke="#d5e5df" stroke-width="2"/>
      ${text("Cách đăng nhập", 76, steps + 25, 32, "#183f50", 700)}
      ${text("1.  Mở " + STUDENT_LOGIN_URL.replace("https://", ""), 76, steps + 76, 27, "#234e62", 700)}
      ${text("2.  Chọn Học sinh rồi nhập số điện thoại và mật khẩu tạm.", 76, steps + 117, 27, "#234e62")}
      ${text("3.  Đặt mật khẩu mới khi website yêu cầu.", 76, steps + 158, 27, "#234e62")}
      <rect x="76" y="${steps + 187}" width="848" height="53" rx="15" fill="#f0f7f3"/>
      ${text("Gửi riêng cho phụ huynh. Nếu mã hết hạn, liên hệ giáo viên.", 97, steps + 221, 25, "#23584e")}
    </g>
  </svg>`;
  return { svg, filename: `phieu-dang-nhap-${slip.phone.slice(-4)}.png` };
}

export async function downloadParentLoginSlip(slip: LoginSlip) {
  const { svg, filename } = buildParentLoginSlip(slip);
  const graphicUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const canvas = document.createElement("canvas");
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không thể mở ảnh phiếu."));
      image.src = graphicUrl;
    });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt chưa hỗ trợ xuất ảnh.");
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(file => file ? resolve(file) : reject(new Error("Không thể tạo file ảnh.")), "image/png");
    });
    const url = URL.createObjectURL(png);
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } finally {
    URL.revokeObjectURL(graphicUrl);
    canvas.width = 0;
    canvas.height = 0;
  }
}
