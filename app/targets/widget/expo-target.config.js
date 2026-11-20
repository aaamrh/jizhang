// iOS 桌面小组件（WidgetKit）。由 @bacons/apple-targets 在 `npx expo prebuild -p ios` 时加进 Xcode 工程。
// App Group 与主 App 一致（app.json → ios.entitlements），用来读主 App 写入的今日/本月花销。
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'ZhangfangWidget',
  displayName: '账房',
  deploymentTarget: '17.0',
  colors: {
    $widgetBackground: '#F4EBD9',
    $accent: '#B5322B',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
})
