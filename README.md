# Drive Music

Drive Music là trình nghe nhạc web tối giản dành cho MP3, FLAC và file âm thanh được chia sẻ công khai từ Google Drive. Ứng dụng hoạt động tốt trên điện thoại, có thể cài như PWA và phát trực tiếp file gốc mà không chuyển mã hay giảm chất lượng.

**Website:** [drive-music.yo-nathanzarate376.chatgpt.site](https://drive-music.yo-nathanzarate376.chatgpt.site)

## Tính năng chính

- Thêm một file nhạc bằng link MP3, FLAC hoặc link file Google Drive công khai.
- Nhập toàn bộ thư mục Google Drive công khai và tự lọc file âm thanh.
- Hỗ trợ MP3, FLAC, M4A, AAC, OGG, OPUS và WAV.
- Tự đọc tên bài hát, nghệ sĩ, album, định dạng và dung lượng khi metadata khả dụng.
- Tạo nhiều playlist riêng, đổi tên, chuyển playlist và xoá playlist có xác nhận.
- Phát, tạm dừng, bài trước, bài sau, tua nhạc, trộn bài và tự động phát.
- Làm nóng trước một phần nhỏ của bài kế tiếp để giảm thời gian chờ khi chuyển bài.
- Giữ bài đang nghe khi người dùng mở playlist khác.
- Lưu thư viện trên trình duyệt khi dùng ở chế độ khách.
- Đăng nhập bằng ChatGPT để đồng bộ playlist giữa các thiết bị.
- Giao diện quản trị được bảo vệ phía máy chủ và chỉ hiển thị tên tài khoản cùng số liệu tổng hợp.
- PWA có thể thêm vào màn hình chính.
- Hỗ trợ Media Session để điều khiển trên màn hình khoá và phát nền tốt nhất trong giới hạn của trình duyệt.
- Giao diện tối, responsive cho iPhone, Android và desktop; toàn bộ biểu tượng dùng SVG.

## Chất lượng âm thanh

Drive Music không tải lại, nén hoặc chuyển mã file nhạc. Trình phát nhận dữ liệu trực tiếp từ nguồn thông qua luồng HTTP có hỗ trợ `Range`, vì vậy chất lượng đầu ra giữ nguyên theo file gốc.

Chất lượng thực tế còn phụ thuộc vào:

- File nguồn.
- Khả năng giải mã định dạng của thiết bị và trình duyệt.
- Thiết bị phát, tai nghe và cài đặt âm lượng hệ thống.
- Tốc độ phản hồi của Google Drive hoặc máy chủ chứa file.

## Cách sử dụng Google Drive

### Thêm một file

1. Mở file nhạc trong Google Drive.
2. Chọn **Chia sẻ**.
3. Đặt quyền thành **Bất kỳ ai có liên kết** và quyền **Người xem**.
4. Sao chép link file rồi dán vào Drive Music.

Ví dụ link hợp lệ:

```text
https://drive.google.com/file/d/FILE_ID/view
```

### Nhập cả thư mục

1. Đặt thư mục thành **Bất kỳ ai có liên kết**.
2. Bảo đảm các thư mục con cần nhập cũng có thể được truy cập công khai.
3. Dán link thư mục vào Drive Music và chọn **Nhập cả thư mục**.

Ví dụ:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

Drive Music chỉ lấy các file âm thanh được hỗ trợ. Ảnh, tài liệu và các định dạng không liên quan sẽ được bỏ qua.

## Playlist và dữ liệu

- Chế độ khách lưu playlist bằng `localStorage` trên từng trình duyệt.
- Mỗi thiết bị có dữ liệu riêng nếu người dùng chưa đăng nhập.
- Khi đăng nhập, metadata và link nhạc được đồng bộ qua cơ sở dữ liệu D1.
- File âm thanh không được tải lên cơ sở dữ liệu của Drive Music.
- Việc xoá playlist có bước xác nhận và luôn giữ lại ít nhất một playlist.

## Đăng nhập và phân quyền

Đăng nhập là tuỳ chọn. Người dùng không cần tài khoản để nghe nhạc và lưu playlist trên thiết bị.

- Xác thực được cung cấp bởi Sign in with ChatGPT.
- Drive Music không nhận hoặc lưu mật khẩu ChatGPT.
- Quyền admin được kiểm tra trong mã phía máy chủ.
- API quản trị từ chối người chưa đăng nhập và người dùng thường.
- Admin chỉ xem tên hiển thị và số liệu tổng hợp; không xem email, nội dung playlist hoặc link nhạc của từng tài khoản.

## Cài đặt PWA

### iPhone và iPad

1. Mở Drive Music bằng Safari.
2. Chọn nút **Chia sẻ**.
3. Chọn **Thêm vào Màn hình chính**.
4. Mở Drive Music từ biểu tượng vừa được tạo.

### Android và desktop

Mở menu của trình duyệt và chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính** khi tuỳ chọn này xuất hiện.

## Giới hạn cần biết

- File và thư mục Google Drive phải được chia sẻ công khai bằng link.
- Google Drive có thể phản hồi chậm hoặc giới hạn tạm thời khi một file được yêu cầu quá nhiều lần.
- iOS có thể tạm ngưng trang web ở chế độ nền. Drive Music đã có cơ chế nối lại và chuyển bài sớm, nhưng tự động chuyển bài nền không thể được bảo đảm tuyệt đối trên mọi phiên bản iOS.
- Điều khiển màn hình khoá phụ thuộc vào Media Session và khả năng của trình duyệt.
- Thanh âm lượng trong ứng dụng được ẩn trên iPhone vì iOS yêu cầu dùng âm lượng hệ thống.

## Công nghệ

- React 19
- Next.js 16
- Vinext và Vite
- Cloudflare Workers
- Cloudflare D1
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
./                                  # thư mục gốc của repository, không có src/src
├── .openai/
│   └── hosting.json                # cấu hình triển khai ChatGPT Sites
├── app/                            # giao diện, xác thực và API routes
│   ├── api/
│   │   ├── admin/stats/route.ts    # thống kê tài khoản dành cho admin
│   │   ├── drive/route.ts          # metadata, thư mục và stream Google Drive
│   │   └── sync/route.ts           # đồng bộ thư viện theo tài khoản
│   ├── authz.ts                    # kiểm tra và phân quyền admin phía máy chủ
│   ├── chatgpt-auth.ts             # phiên đăng nhập ChatGPT
│   ├── globals.css                 # giao diện responsive và PWA safe area
│   ├── layout.tsx                  # metadata, manifest và layout gốc
│   └── page.tsx                    # trình phát, playlist và logic phía client
├── build/
│   └── sites-vite-plugin.ts        # tích hợp quá trình build cho Sites
├── db/
│   ├── index.ts                    # kết nối Cloudflare D1
│   └── schema.ts                   # schema thư viện nhạc
├── drizzle/                        # migration và snapshot cơ sở dữ liệu
├── examples/d1/                    # ví dụ tối giản cho D1
├── public/
│   ├── icon-192.png                # icon PWA 192 × 192
│   ├── icon-512.png                # icon PWA 512 × 512
│   ├── manifest.webmanifest        # cấu hình cài đặt PWA
│   └── sw.js                       # Service Worker
├── scripts/                        # build, cài CI và kiểm tra artifact
├── tests/
│   └── rendered-html.test.mjs      # test UI, Drive proxy và phân quyền
├── worker/
│   └── index.ts                    # entry Cloudflare Worker
├── drizzle.config.ts               # cấu hình Drizzle Kit
├── next.config.ts                  # header bảo mật và cấu hình Next.js
├── vite.config.ts                  # cấu hình Vinext/Vite
├── package.json                    # scripts và dependencies
└── README.md
```

## Bảo mật

- CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` và các header bảo mật khác được cấu hình cho bản production.
- API đồng bộ giới hạn kích thước request, số playlist, số bài hát và chỉ nhận URL HTTP/HTTPS hợp lệ.
- Request đồng bộ khác origin bị từ chối.
- Dữ liệu mỗi tài khoản được tách bằng định danh băm.
- Không commit file `.env`, token, cookie hoặc thông tin đăng nhập vào repository.

## Tác giả

Built by [Khang](https://github.com/mm4you) with Codex.
