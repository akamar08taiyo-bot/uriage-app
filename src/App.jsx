import { useState, useEffect } from 'react'
import UriageDenpyo from './components/UriageDenpyo.jsx'
import JuchuBo from './components/JuchuBo.jsx'

// マスタ：デフォルトは空。タブごとに項目を持つ。
const JUCHU_MASTER_KEY = 'juchu_master_v1'
const URIAGE_MASTER_KEY = 'uriage_master_v1'
// 受注簿の「特例」セクションの状態（住宅改修・特定福祉用具用）。
// このオブジェクトに入力した内容は売上伝票発行依頼書に自動転記される。
const BRIDGE_KEY = 'attr_bridge_v1'
const defaultBridge = {
  enabled: false,
  serviceType: 'housing',
  items: [{ id: 1, amount: 0, cost: 0, productName: '', color: '' }],
  customerType: 'new',
  billingType: 'receipt',
  careLevel: '支援１',
  userRatio: 0.1,
  isSelfPay: false,
  remaining: 200000,
  contractor: '',
  categories: [],
}

function loadMaster(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    if (v && typeof v === 'object') return { ...fallback, ...v }
  } catch {}
  return fallback
}

function MasterListInput({ items, onChange, placeholder }) {
  const list = items.length ? items : ['']
  const update = (i, v) => onChange(list.map((n, idx) => (idx === i ? v : n)).filter((_, idx) => idx !== i || v !== '' || list.length === 1))
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, ''])
  return (
    <div>
      <div className="space-y-1">
        {list.map((name, i) => (
          <div className="flex gap-1" key={i}>
            <input
              type="text"
              value={name}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="h-9 w-9 rounded-lg text-xs text-red-400 hover:bg-red-50 transition"
            >×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1 text-xs text-blue-600 hover:text-blue-800">＋ 追加</button>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState(() => (/#\/?order/.test(location.hash) ? 'juchu' : 'uriage'))
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('fukushi_zoom')) || 120)
  const [showMaster, setShowMaster] = useState(false)

  const [juchuMaster, setJuchuMaster] = useState(() =>
    loadMaster(JUCHU_MASTER_KEY, { offices: [], staff: [], orderers: [] }),
  )
  const [uriageMaster, setUriageMaster] = useState(() =>
    loadMaster(URIAGE_MASTER_KEY, { offices: [], salesPersons: [], contractors: [] }),
  )
  const [bridge, setBridge] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(BRIDGE_KEY) || 'null')
      if (v && typeof v === 'object') return { ...defaultBridge, ...v }
    } catch {}
    return defaultBridge
  })
  useEffect(() => { localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge)) }, [bridge])

  useEffect(() => { localStorage.setItem(JUCHU_MASTER_KEY, JSON.stringify(juchuMaster)) }, [juchuMaster])
  useEffect(() => { localStorage.setItem(URIAGE_MASTER_KEY, JSON.stringify(uriageMaster)) }, [uriageMaster])
  useEffect(() => {
    localStorage.setItem('fukushi_zoom', zoom)
    document.documentElement.style.fontSize = `${zoom}%`
  }, [zoom])

  const zoomUp = () => setZoom((z) => Math.min(z + 10, 200))
  const zoomDown = () => setZoom((z) => Math.max(z - 10, 80))

  const updateJuchu = (key, list) => setJuchuMaster((m) => ({ ...m, [key]: list }))
  const updateUriage = (key, list) => setUriageMaster((m) => ({ ...m, [key]: list }))

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
              >−</button>
              <span className="text-[10px] text-blue-100 w-8 text-center">{zoom}%</span>
              <button
                type="button"
                onClick={zoomUp}
                className="w-6 h-6 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold flex items-center justify-center transition"
              >＋</button>
            </div>
            <button
              type="button"
              onClick={() => setShowMaster((v) => !v)}
              className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 transition"
            >
              <span className="text-sm">⚙</span>
              {showMaster ? 'マスタを閉じる' : 'マスタ設定'}
            </button>
          </div>
        </div>
        {/* タブバー */}
        <nav className="bg-slate-100 border-b border-slate-200 text-slate-800">
          <div className="max-w-[1500px] mx-auto px-4 flex">
            <button type="button" className={tabClass('uriage')} onClick={() => setTab('uriage')}>
              売上伝票発行依頼書
            </button>
            <button type="button" className={tabClass('juchu')} onClick={() => setTab('juchu')}>
              販売受注簿
            </button>
          </div>
        </nav>
      </header>

      {/* マスタ設定パネル */}
      {showMaster && (
        <div className="max-w-[1500px] mx-auto px-4 pt-3 print:hidden">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-4 grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-slate-700 border-b border-slate-200 pb-1">
                販売受注簿
              </h2>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">営業所</label>
                <MasterListInput items={juchuMaster.offices} onChange={(v) => updateJuchu('offices', v)} placeholder="営業所名" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">営業担当</label>
                <MasterListInput items={juchuMaster.staff} onChange={(v) => updateJuchu('staff', v)} placeholder="営業担当名" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">発注者</label>
                <MasterListInput items={juchuMaster.orderers} onChange={(v) => updateJuchu('orderers', v)} placeholder="発注者名" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-slate-700 border-b border-slate-200 pb-1">
                売上伝票発行依頼書
              </h2>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">営業所</label>
                <MasterListInput items={uriageMaster.offices} onChange={(v) => updateUriage('offices', v)} placeholder="営業所名" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">営業員</label>
                <MasterListInput items={uriageMaster.salesPersons} onChange={(v) => updateUriage('salesPersons', v)} placeholder="営業員名" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">施工業者</label>
                <MasterListInput items={uriageMaster.contractors} onChange={(v) => updateUriage('contractors', v)} placeholder="施工業者名" />
              </div>
            </div>
            <div className="md:col-span-2 pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 mb-2">
                ※ 入力は必須ではありません。空欄のまま運用できます。設定内容はこのパソコンに保存されます。
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
        <JuchuBo master={juchuMaster} bridge={bridge} setBridge={setBridge} />
      </div>
      <div className={tab === 'uriage' ? '' : 'hidden'}>
        <UriageDenpyo master={uriageMaster} bridge={bridge} setBridge={setBridge} />
      </div>
    </div>
  )
}
