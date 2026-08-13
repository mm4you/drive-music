# Drive Music

Drive Music là trình nghe nhạc web tối giản với 30 bài dùng chung. Ứng dụng hoạt động tốt trên điện thoại, có thể cài như PWA và phát file gốc mà không chuyển mã hay giảm chất lượng.

**Website:** [drive-music.yo-nathanzarate376.chatgpt.site](https://drive-music.yo-nathanzarate376.chatgpt.site)

## Tính năng chính

- Tự sao chép 30 file nguồn sang kho âm thanh R2 dùng chung của Drive Music.
- Hỗ trợ MP3, FLAC, M4A, AAC, OGG, OPUS và WAV.
- Tự đọc tên bài hát, nghệ sĩ, album và định dạng khi metadata khả dụng.
- Danh sách phát gọn nhẹ, có thể ẩn hoặc hiện khi cần.
- Phát, tạm dừng, bài trước, bài sau, tua nhạc, trộn bài, phát lại bài hiện tại 1 hoặc 2 lần và tự động phát.
- Làm nóng trước một phần nhỏ của bài kế tiếp để giảm thời gian chờ khi chuyển bài.
- Không cần tài khoản; người dùng đăng nhập hay không đều nghe cùng một danh sách 30 bài.
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

## Thư viện 30 bài dùng chung

Nguồn ban đầu là thư mục Google Drive công khai đã cấu hình sẵn trong mã. Trong lần chuẩn bị đầu tiên, website sao chép tuần tự từng file vào Cloudflare R2 và ghi manifest chung.

- Giao diện hiển thị tiến độ `đã lưu/tổng số bài`.
- Quá trình có thể tiếp tục ở lần mở trang sau nếu bị gián đoạn.
- Khi manifest hoàn tất, mọi người tự động nhận cùng một danh sách.
- File phát qua endpoint cùng miền có hỗ trợ HTTP `Range`, tua nhạc và cache.
- Nút đăng nhập và nhập link được ẩn khi thư viện chung đã sẵn sàng.

Folder nguồn hiện tại:

```text
https://drive.google.com/drive/folders/1yLdID1cWy3JmLB3TAUiazxBcRAja0Xpt
```

Thư mục chỉ cần tiếp tục công khai cho tới khi tiến độ đạt đủ toàn bộ bài. Sau đó việc nghe nhạc không còn phụ thuộc vào tốc độ phản hồi của Google Drive.

## Danh sách phát và dữ liệu

- R2 lưu byte gốc của 30 file âm thanh.
- Manifest R2 lưu thứ tự và metadata công khai của danh sách chung.
- `localStorage` chỉ lưu cài đặt giao diện và điều khiển trên từng thiết bị.
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

- Trong giai đoạn sao chép ban đầu, thư mục Google Drive nguồn phải công khai.
- iOS có thể tạm ngưng trang web ở chế độ nền. Drive Music đã có cơ chế nối lại và chuyển bài sớm, nhưng tự động chuyển bài nền không thể được bảo đảm tuyệt đối trên mọi phiên bản iOS.
- Điều khiển màn hình khoá phụ thuộc vào Media Session và khả năng của trình duyệt.
- Thanh âm lượng trong ứng dụng được ẩn trên iPhone vì iOS yêu cầu dùng âm lượng hệ thống.

## Công nghệ

- React 19
- Next.js 16
- Vinext và Vite
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Drizzle ORM
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
| `npm run db:generate` | Tạo migration Drizzle sau khi đổi schema |
| `npm run validate:artifact` | Kiểm tra lại artifact hiện có |

## Cấu trúc chính

```text
app/
  api/admin/stats/   API thống kê dành cho admin
  api/drive/         Đọc metadata, thư mục và stream Google Drive
  api/sync/          Đồng bộ thư viện theo tài khoản
  page.tsx           Giao diện và logic trình phát
db/
  schema.ts          Schema thư viện nhạc trên D1
drizzle/             Các migration cơ sở dữ liệu
public/
  manifest.webmanifest
  sw.js              Service Worker cho PWA
tests/               Test giao diện, Drive proxy và phân quyền
```

## Bảo mật

- CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` và các header bảo mật khác được cấu hình cho bản production.
- API đồng bộ giới hạn kích thước request, số playlist, số bài hát và chỉ nhận URL HTTP/HTTPS hợp lệ.
- Request đồng bộ khác origin bị từ chối.
- Dữ liệu mỗi tài khoản được tách bằng định danh băm.
- Không commit file `.env`, token, cookie hoặc thông tin đăng nhập vào repository.

## Tác giả

Built by [Khang](https://github.com/mm4you) with Codex.
