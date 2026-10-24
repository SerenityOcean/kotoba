// 在 React 起来之前就定下深浅色，夜里打开时不会先闪一下白。
// 规则和 src/theme.ts 的 useThemeState 一样：记过就用记的，没记过跟系统。
// 单独放一个文件而不是内联在 index.html 里：CSP 的 script-src 只放行 'self'。
// self 有自己的昼夜，不归这里管。
;(function () {
  if (location.pathname.indexOf('/self') === 0) return
  var stored = null
  try {
    stored = localStorage.getItem('kotoba:theme')
  } catch {
    // 存不了就当没记过
  }
  var dark =
    stored === 'dark' ||
    (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.dataset.theme = 'dark'
})()
