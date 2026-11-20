module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // drizzle 生成的迁移是 .sql 文件，打包时内联成字符串
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  }
}
