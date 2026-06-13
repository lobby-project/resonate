/* ============================================================
   ⚠️ SCHEMA MAPPING — Claude Code 唯一需要核对的文件
   管理台读写 events 表的"既有列"(001~005 建的)。列名按主项目
   惯例推断,请对照真实 schema 核对;改这里即可,别处不用动。
   ============================================================ */
export const COL_TITLE = "artist"; // 自办活动标题写进 artist 列(产品端直接当标题渲染)
export const COL_VENUE = "venue"; // 场馆名列
export const COL_LAT = "lat"; // 纬度列(若实际叫 latitude 改这里)
export const COL_LNG = "lng"; // 经度列

// events.event_date 是 `date` 列(NULLABLE 实测确认);TBD 时写此占位以兼容潜在 NOT NULL,
// 并便于 publishEvent 的 sentinel 比较(date 列存进去就是 "2099-01-01",ISO 时间戳会被截断)。
export const TBD_DATE_SENTINEL = "2099-01-01";

// ⚠️ 与产品端 12 genres 一字不差(主项目 ticketmaster.ts 写库格式,带空格)
export const GENRES = [
  "Electronic / EDM",
  "Hip-Hop / Rap",
  "Pop",
  "Rock",
  "R&B / Soul",
  "Jazz / Blues",
  "Indie / Alternative",
  "Metal / Punk",
  "Latin",
  "Country / Folk",
  "Reggae",
  "Classical / Orchestra",
];

export const DEFAULT_TICKET_NOTE =
  "This is your event ticket. Present the QR code on entry — printed or on your phone. " +
  "Questions or refunds: contact the event host. See you there!";
