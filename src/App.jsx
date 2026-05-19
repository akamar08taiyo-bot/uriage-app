import { useState, useEffect } from 'react'
import UriageDenpyo from './components/UriageDenpyo.jsx'
import JuchuBo from './components/JuchuBo.jsx'

const DEFAULT_STAFF = ['久保', '土居', '宮村', '信田']
const DEFAULT_OFFICE = '太陽シルバーサービス株式会社 行橋営業所'

function loadArray(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

const panelInput =
  'w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition'

export default function App() {
  const [tab, setTab] = useState(() => (/#\/?order/.test(location.hash) ? 'juchu' : 'uriage'))
  const [showMaster, setShowMaster] = useState(false)
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('fukushi_zoom')) || 120)

  const [staffList, setStaffList] = useState(() => {
    const s = loadArray('fukushi_staffList', null)
    return s && s.length ? s : DEFAULT_STAFF
  })
  const [officeMaster, setOfficeMaster] = useState(
    () => localStorage.getItem('fukushi_office') || DEFAULT_OFFICE,
  )
  const [contractorList, setContractorList] = useState(() => loadArray('fukushi_contractorList', []))

  useEffect(() => {
    localStorage.setItem('fukushi_staffList', JSON.stringify(staffList))
  }, [staffList])
  useEffect(() => {
    localStorage.setItem('fukushi_office', officeMaster)
  }, [officeMaster])
  useEffect(() => {
    localStorage.setItem('fukushi_contractorList', JSON.stringify(contractorList))
  }, [contractorList])
  useEffect(() => {
    localStorage.setItem('fukushi_zoom', zoom)
    document.documentElement.style.fontSize = `${zoom}%`
  }, [zoom])

  const zoomUp = () => setZoom((z) => Math.min(z + 10, 200))
  const zoomDown = () => setZoom((z) => Math.max(z - 10, 80))

  const updateStaff = (i, v) => setStaffList((p) => p.map((n, idx) => (idx === i ? v : n)))
  const removeStaff = (i) => setStaffList((p) => p.filter((_, idx) => idx !== i))
  const addStaff = () => setStaffList((p) => [...p, ''])

  const updateContractor = (i, v) => setContractorList((p) => p.map((n, idx) => (idx === i ? v : n)))
  const removeContractor = (i) => setContractorList((p) => p.filter((_, idx) => idx !== i))
  const addContractor = () => setContractorList((p) => [...p, ''])

  const tabClass = (id) =>
    `h-9 px-4 rounded-lg text-sm font-bold transition ${
      tab === id ? 'bg-white text-blue-700 shadow-sm' : 'bg-blue-500/40 text-white hover:bg-blue-500/60'
    }`

  return (
    <div className="app-bg min-h-screen">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-blue-600 text-white shadow-md px-4 py-2 print:hidden">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wide whitespace-nowrap">
              販売受注・売上伝票 統合システム
            </h1>
            <nav className="flex gap-1">
              <button type="button" className={tabClass('juchu')} onClick={() => setTab('juchu')}>
                販売受注簿
              </button>
              <button type="button" className={tabClass('uriage')} onClick={() => setTab('uriage')}>
                売上伝票発行依頼書
              </button>
            </nav>
          </div>
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
            <button
              type="button"
              onClick={() => setShowMaster((v) => !v)}
              className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium bg-white text-blue-600 hover:bg-blue-50 transition"
            >
              <span className="text-sm">⚙</span>
              {showMaster ? 'マスタを閉じる' : 'マスタ設定'}
            </button>
          </div>
        </div>
      </header>

      {/* マスター管理パネル（両タブ共通） */}
      {showMaster && (
        <div className="max-w-6xl mx-auto px-4 pt-3 print:hidden">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-4 space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em]">
              マスター管理（販売受注簿・売上伝票で共通）
            </p>

            {/* 担当者リスト（共通） */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                担当者リスト <span className="text-[10px] font-normal text-blue-500">※両タブ共通</span>
              </label>
              <div className="space-y-1">
                {staffList.map((name, i) => (
                  <div key={i} className="flex gap-1">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateStaff(i, e.target.value)}
                      className={`${panelInput} flex-1`}
                      placeholder="担当者名"
                    />
                    {staffList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStaff(i)}
                        className="h-9 w-9 rounded-lg text-xs text-red-400 hover:bg-red-50 transition"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addStaff} className="mt-1 text-xs text-blue-500 hover:text-blue-700">
                ＋ 追加
              </button>
            </div>

            {/* 事業所名 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">事業所名</label>
              <input
                type="text"
                value={officeMaster}
                onChange={(e) => setOfficeMaster(e.target.value)}
                className={panelInput}
              />
            </div>

            {/* 施工業者リスト */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                施工業者リスト（住宅改修）
              </label>
              <div className="space-y-1">
                {contractorList.map((name, i) => (
                  <div key={i} className="flex gap-1">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateContractor(i, e.target.value)}
                      className={`${panelInput} flex-1`}
                      placeholder="施工業者名"
                    />
                    <button
                      type="button"
                      onClick={() => removeContractor(i)}
                      className="h-9 w-9 rounded-lg text-xs text-red-400 hover:bg-red-50 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {contractorList.length === 0 && (
                  <p className="text-[11px] text-slate-400">未登録</p>
                )}
              </div>
              <button
                type="button"
                onClick={addContractor}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700"
              >
                ＋ 追加
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 mb-2">
                ※ 設定内容はこのパソコンに保存され、次回以降は自動で適用されます。
              </p>
              <button
                type="button"
                onClick={() => setShowMaster(false)}
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
              >
                確定して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* タブ内容（両方マウントしたまま表示切替＝入力内容を保持） */}
      <div className={tab === 'juchu' ? 'p-3 print:p-0' : 'hidden'}>
        <JuchuBo staffList={staffList} />
      </div>
      <div className={tab === 'uriage' ? '' : 'hidden'}>
        <UriageDenpyo staffList={staffList} officeMaster={officeMaster} contractorList={contractorList} />
      </div>
    </div>
  )
}
