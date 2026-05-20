import { useState, useEffect } from 'react'
import UriageDenpyo from './components/UriageDenpyo.jsx'
import JuchuBo from './components/JuchuBo.jsx'

const STAFF_LIST = ['久保', '土居', '宮村', '信田']
const OFFICE_NAME = '太陽シルバーサービス株式会社 行橋営業所'

export default function App() {
  const [tab, setTab] = useState(() => (/#\/?uriage/.test(location.hash) ? 'uriage' : 'juchu'))
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('fukushi_zoom')) || 120)

  useEffect(() => {
    localStorage.setItem('fukushi_zoom', zoom)
    document.documentElement.style.fontSize = `${zoom}%`
  }, [zoom])

  const zoomUp = () => setZoom((z) => Math.min(z + 10, 200))
  const zoomDown = () => setZoom((z) => Math.max(z - 10, 80))

  const tabClass = (id) =>
    `relative h-12 px-7 text-sm font-extrabold transition border-b-[3px] -mb-px ${
      tab === id
        ? 'text-blue-700 border-blue-600 bg-white shadow-[0_-1px_0_0_#fff_inset]'
        : 'text-slate-500 hover:text-blue-700 border-transparent hover:bg-slate-50'
    }`

  return (
    <div className="app-bg min-h-screen font-sans">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-blue-600 text-white shadow-md print:hidden">
        <div className="max-w-[1500px] mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-sans text-sm font-bold tracking-wide whitespace-nowrap">
            販売受注簿・売上伝票発行依頼書
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={zoomDown}
                className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold flex items-center justify-center transition"
              >
                −
              </button>
              <span className="text-[10px] text-blue-100 w-8 text-center">{zoom}%</span>
              <button
                type="button"
                onClick={zoomUp}
                className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold flex items-center justify-center transition"
              >
                ＋
              </button>
            </div>
          </div>
        </div>
        {/* タブバー */}
        <nav className="bg-slate-100 border-b border-slate-200 text-slate-800">
          <div className="max-w-[1500px] mx-auto px-4 flex">
            <button type="button" className={tabClass('juchu')} onClick={() => setTab('juchu')}>
              販売受注簿
            </button>
            <button type="button" className={tabClass('uriage')} onClick={() => setTab('uriage')}>
              売上伝票発行依頼書
            </button>
          </div>
        </nav>
      </header>

      {/* タブ内容（両方マウントしたまま表示切替＝入力内容を保持） */}
      <div className={tab === 'juchu' ? 'p-3 print:p-0' : 'hidden'}>
        <JuchuBo staffList={STAFF_LIST} />
      </div>
      <div className={tab === 'uriage' ? '' : 'hidden'}>
        <UriageDenpyo staffList={STAFF_LIST} officeMaster={OFFICE_NAME} />
      </div>
    </div>
  )
}
