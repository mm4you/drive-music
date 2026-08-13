# Drive Music

Drive Music là trình nghe album **HVL** của **RPT MCK** trên web với 30 bài FLAC dùng chung. Ứng dụng hoạt động tốt trên điện thoại, có thể cài như PWA và phát file gốc mà không chuyển mã hay giảm chất lượng.

**Website:** [drive-music.yo-nathanzarate376.chatgpt.site](https://drive-music.yo-nathanzarate376.chatgpt.site)

## Tính năng chính

- 30 file FLAC đã được lưu trong kho âm thanh R2 dùng chung của Drive Music.
- Metadata thống nhất theo album `HVL` và nghệ sĩ `RPT MCK`.
- Danh sách phát gọn nhẹ, có thể ẩn hoặc hiện khi cần.
- Phát, tạm dừng, bài trước, bài sau, tua nhạc, trộn bài, phát lại bài hiện tại 1 hoặc 2 lần và tự động phát.
- Làm nóng trước một phần nhỏ của bài kế tiếp để giảm thời gian chờ khi chuyển bài.
- Không cần tài khoản, không cần nhập link; mọi người nghe cùng một danh sách 30 bài.
- Menu Giới thiệu cung cấp tổng quan ngắn về HVL và RPT MCK.
- PWA có thể thêm vào màn hình chính.
- Hỗ trợ Media Session để điều khiển trên màn hình khoá và phát nền tốt nhất trong giới hạn của trình duyệt.
- Giao diện tối, responsive cho iPhone, Android và desktop; toàn bộ biểu tượng dùng SVG.

## Chất lượng âm thanh

Drive Music không nén hoặc chuyển mã file nhạc. Trình phát nhận dữ liệu từ kho R2 thông qua luồng HTTP có hỗ trợ `Range`, vì vậy chất lượng đầu ra giữ nguyên theo file gốc.

Chất lượng thực tế còn phụ thuộc vào:

- File nguồn.
- Khả năng giải mã định dạng của thiết bị và trình duyệt.
- Thiết bị phát, tai nghe và cài đặt âm lượng hệ thống.
- Kết nối mạng tới kho âm thanh của Drive Music.

## Album 30 bài dùng chung

Nguồn ban đầu là thư mục Google Drive công khai. Toàn bộ 30 file đã được sao chép vào Cloudflare R2 và ghi vào manifest chung trước khi phát hành giao diện hiện tại.

- Mọi người tự động nhận cùng một danh sách theo đúng thứ tự album.
- File phát qua endpoint cùng miền có hỗ trợ HTTP `Range`, tua nhạc và cache.
- Giao diện không chứa đăng nhập, đồng bộ tài khoản hoặc nhập link.

Folder nguồn hiện tại:

```text
https://drive.google.com/drive/folders/1yLdID1cWy3JmLB3TAUiazxBcRAja0Xpt
```

Việc nghe nhạc hiện không còn phụ thuộc vào tốc độ phản hồi của Google Drive.

## Danh sách phát và dữ liệu

- R2 lưu byte gốc của 30 file âm thanh.
- Manifest R2 lưu thứ tự và metadata công khai của danh sách chung.
- `localStorage` chỉ lưu các thiết lập điều khiển trên từng thiết bị.
- Người nghe không cần tạo tài khoản hay nhập link.

## Cài đặt PWA

### iPhone và iPad

1. Mở Drive Music bằng Safari.
2. Chọn nút **Chia sẻ**.
3. Chọn **Thêm vào Màn hình chính**.
4. Mở Drive Music từ biểu tượng vừa được tạo.

### Android và desktop

Mở menu của trình duyệt và chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính** khi tuỳ chọn này xuất hiện.

## Giới hạn cần biết

- iOS có thể tạm ngưng trang web ở chế độ nền. Drive Music đã có cơ chế nối lại và chuyển bài sớm, nhưng tự động chuyển bài nền không thể được bảo đảm tuyệt đối trên mọi phiên bản iOS.
- Điều khiển màn hình khoá phụ thuộc vào Media Session và khả năng của trình duyệt.
- Thanh âm lượng trong ứng dụng được ẩn trên iPhone vì iOS yêu cầu dùng âm lượng hệ thống.

## Công nghệ

- React 19
- Next.js 16
- Vinext và Vite
- Cloudflare Workers
- Cloudflare R2
- Media Session API
- Web App Manifest và Service Worker

## Chạy dự án cục bộ

### Yêu cầu

- Node.js `>=22.13.0`
- npm
- Môi trường Linux hoặc WSL được khuyến nghị cho các script build hiện tại

### Cài đặt

```bash
git clone https://github.com/mm4you/drive-music.git
cd drive-music
npm ci
npm run dev
```

### Kiểm tra

```bash
npm run lint
npm test
```

### Build production

```bash
npm run build
```

## Các lệnh có sẵn

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Build và kiểm tra artifact triển khai |
| `npm run start` | Chạy bản đã build |
| `npm run lint` | Kiểm tra mã nguồn bằng ESLint |
| `npm test` | Build và chạy bộ test |
| `npm run validate:artifact` | Kiểm tra lại artifact hiện có |

## Cấu trúc chính

```text
app/
  api/catalog/       Manifest chung và stream R2 có HTTP Range
  api/drive/         Bộ đọc nguồn Google Drive dùng khi bảo trì
  page.tsx           Giao diện và logic trình phát
public/
  manifest.webmanifest
  sw.js              Service Worker cho PWA
tests/               Test giao diện, thư viện và Drive proxy
```

## Bảo mật

- CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` và các header bảo mật khác được cấu hình cho bản production.
- Cổng chuyển file nội bộ được khóa sau khi hoàn tất 30/30 bài.
- Endpoint phát chỉ cho phép object key trong không gian `audio/` và chặn path traversal.
- Manifest công khai không chứa token hay thông tin nguồn nhạy cảm.
- Không commit file `.env`, token, cookie hoặc thông tin đăng nhập vào repository.

## Tác giả

Built by [Khang](https://github.com/mm4you) with Codex.
