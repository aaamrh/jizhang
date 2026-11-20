import SwiftUI
import WidgetKit

// 和 src/widgets/sync.tsx 的 APP_GROUP 一致
private let appGroup = "group.com.zhangfang.app"
private let seal = Color(red: 0xB5 / 255, green: 0x32 / 255, blue: 0x2B / 255)
private let ink = Color(red: 0x2B / 255, green: 0x21 / 255, blue: 0x18 / 255)
private let muted = Color(red: 0x7A / 255, green: 0x6A / 255, blue: 0x58 / 255)
private let paper = Color(red: 0xF4 / 255, green: 0xEB / 255, blue: 0xD9 / 255)

struct SpendEntry: TimelineEntry {
  let date: Date
  let todayCents: Int
  let monthCents: Int
}

struct SpendProvider: TimelineProvider {
  func placeholder(in context: Context) -> SpendEntry {
    SpendEntry(date: Date(), todayCents: 0, monthCents: 0)
  }

  func getSnapshot(in context: Context, completion: @escaping (SpendEntry) -> Void) {
    completion(load())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SpendEntry>) -> Void) {
    // 主 App 每次记账后会主动刷新；另外在明天零点刷新一次，让"今日"归零
    let tomorrow = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
    completion(Timeline(entries: [load()], policy: .after(tomorrow)))
  }

  /// 主 App 写入 day（YYYY-MM-DD）、todayCents、monthCents。日期过期时对应数字按 0 显示
  private func load() -> SpendEntry {
    let defaults = UserDefaults(suiteName: appGroup)
    let day = defaults?.string(forKey: "day") ?? ""
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    let today = f.string(from: Date())
    let todayCents = day == today ? (defaults?.integer(forKey: "todayCents") ?? 0) : 0
    let monthCents = day.prefix(7) == today.prefix(7) ? (defaults?.integer(forKey: "monthCents") ?? 0) : 0
    return SpendEntry(date: Date(), todayCents: todayCents, monthCents: monthCents)
  }
}

private func yuan(_ cents: Int) -> String {
  let f = NumberFormatter()
  f.numberStyle = .decimal
  f.minimumFractionDigits = 0  // 整数不显示小数，12.50 显示 12.5
  f.maximumFractionDigits = 2
  return "¥" + (f.string(from: NSNumber(value: Double(cents) / 100)) ?? "0")
}

struct SpendWidgetView: View {
  var entry: SpendEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text("账房").font(.system(size: 13, design: .serif)).foregroundColor(seal)
        Spacer()
      }
      Spacer(minLength: 0)
      Text("今日已花").font(.system(size: 11, design: .serif)).foregroundColor(muted)
      Text(yuan(entry.todayCents)).font(.system(size: 22, design: .serif)).foregroundColor(ink).minimumScaleFactor(0.6).lineLimit(1)
      Text("本月 " + yuan(entry.monthCents)).font(.system(size: 11, design: .serif)).foregroundColor(muted).lineLimit(1)
      Spacer(minLength: 0)
      Text("记一笔")
        .font(.system(size: 13, design: .serif))
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(seal)
        .cornerRadius(6)
    }
    .containerBackground(paper, for: .widget)
    // 小尺寸小组件只能整体点击：直接打开记一笔
    .widgetURL(URL(string: "zhangfang://add"))
  }
}

struct SpendWidget: Widget {
  let kind = "SpendWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SpendProvider()) { entry in
      SpendWidgetView(entry: entry)
    }
    .configurationDisplayName("今日花销")
    .description("今日、本月已花，点一下就能记一笔")
    .supportedFamilies([.systemSmall])
  }
}

@main
struct ZhangfangWidgets: WidgetBundle {
  var body: some Widget {
    SpendWidget()
  }
}
