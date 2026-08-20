import { syncedLyricsPart1 } from "./synced-part-1";
import { syncedLyricsPart2 } from "./synced-part-2";
import { syncedLyricsPart3 } from "./synced-part-3";

const intenpolTimedLyrics = `[00:00.00]
[00:00.30](MCK, MCK, MCK)
[00:02.20]Đứng ở dưới thì nhảy mạnh lên
[00:04.10]Ai sợ thì đi về
[00:05.70]Dân mạng vô cùng bức xúc trước lời chia sẻ của MC-mạng vô-dân mạng vô-vô cùng-vô cùng bức
[00:09.40]Thậm chí, thái độ bị cho là đang thách thức khán-thậm chí-thậm chí-đang-thậm chí
[00:14.80]Đề cập, Phát Thanh Truyền Hình cũng đã đề cập-đề cập-đề cập
[00:18.00]MCK vẫn bị chê nhạc dở
[00:20.40]Phát ngôn, hành động của
[00:22.60]K vẫn-K vẫn-K vẫn bị-vẫn bị
[00:24.00]Ngông trên sân khấu
[00:26.00]Bị tố-sân khấu-sân khấu-bị tố
[00:28.00]Tự dưng nhiều view thế nhở
[00:30.40]Nổi tiếng-nổi tiếng-nhiều vi-nhiều
[00:32.80]Nhiều view-view
[00:34.50]That's my mo'fucking ninja, MCK, man
[00:37.60]Top một trending, và được chương trình giải trí với công chúng với
[00:42.00]MCK đã đánh bại HIEUTHUHAI
[00:44.00]M-M-M
[00:45.00]Rapper "Ai sợ thì đi về"
[00:47.00]Đã thuộc-của MCK, thì người đấy có quyền
[00:49.00]What I'm talking about, G, that shit slap, that shit tough, that shit hard
[00:52.00]Thì mình có giải thưởng dành cho
[00:53.20]99%, MCK`;

export const syncedLyricsByTrackId: Readonly<Record<string, string>> = {
  ...syncedLyricsPart1,
  ...syncedLyricsPart2,
  "track-16": intenpolTimedLyrics,
  ...syncedLyricsPart3,
};

export const estimatedSyncTrackIds = new Set(["track-16"]);
