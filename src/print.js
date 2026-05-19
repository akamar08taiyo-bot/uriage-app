// 印刷時の用紙向きをタブごとに切り替える。
// CSS の @page はグローバルなため、印刷直前に動的注入する。
export function printDoc(orientation = 'portrait') {
  let style = document.getElementById('print-page-style')
  if (!style) {
    style = document.createElement('style')
    style.id = 'print-page-style'
    document.head.appendChild(style)
  }
  style.textContent =
    orientation === 'landscape'
      ? '@page { size: A4 landscape; margin: 8mm; }'
      : '@page { size: A4; margin: 15mm; }'
  window.print()
}
