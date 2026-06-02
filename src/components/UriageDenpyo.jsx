import { useState, useEffect, useMemo } from 'react'
import { printDoc } from '../print.js'
import { encodePayload, decodePayload, shortenUrl, readPayloadFromHash, writeClipboard } from '../share.js'

/* ── 定数 ─────────────────────────────────── */
const DEFAULT_REMAINING = { housing: 200000, specific: 100000 }
const CARE_LEVELS = ['支援１', '支援２', '介護１', '介護２', '介護３', '介護４', '介護５']
const CATALOGS = ['ケアマックス', 'ウェルファン']
const TAX = 1.1
// 特定福祉用具の種目（複数選択可）
const SPECIFIC_CATEGORIES = [
  '入浴補助用具',
  '浴槽台',
  '腰掛便座',
  'スロープ',
  '歩行器',
  '歩行補助杖',
  '移動用リフトのつり具',
  '自動排泄処理装置の交換可能備品',
  '排泄予測支援機器',
  '簡易浴槽',
]

let _seq = 0
const newItem = () => ({ id: ++_seq, amount: 0, cost: 0, catalog: 'ケアマックス', productName: '', color: '' })
const fmt = (n) => `¥${Math.round(n || 0).toLocaleString()}`
// 税抜は切り上げ（例: 39,680 → 36,073、80,900 → 73,546）
const exTax = (n) => Math.ceil((n || 0) / TAX)

/* ── 計算ロジック ────────────────────────────── */
function calculate({ items, total, remaining, userRatio, miyako, isSelfPay }) {
  const insuranceRatio = 1 - userRatio
  const effRemaining = isSelfPay ? 0 : remaining
  const insuranceCovered = Math.min(total, effRemaining)
  const excess = Math.max(0, total - effRemaining)
  let userBurden, insurerBurden
  if (miyako) {
    userBurden = items.reduce((s, it) => s + Math.ceil(it.amount * userRatio), 0)
    insurerBurden = Math.max(0, insuranceCovered - userBurden)
  } else {
    userBurden = Math.ceil(insuranceCovered * userRatio)
    insurerBurden = Math.floor(insuranceCovered * insuranceRatio)
  }
  return { total, insuranceCovered, excess, userBurden, insurerBurden, totalUserBurden: userBurden + excess }
}

/* ── スタイル定数 ─────────────────────────────── */
const card = 'bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-3'
const sectionTitle = 'text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2'
const fieldLabel = 'block text-[11px] font-medium text-slate-500 mb-1'
const baseInput = 'w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-800 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition'
const noSpin = '[-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0'

/* ── 小コンポーネント ─────────────────────────── */
function OptionRow({ label, options, value, onChange, cols }) {
  return (
    <div>
      <span className={fieldLabel}>{label}</span>
      <div className={`grid gap-1 ${cols || `grid-cols-${options.length}`}`}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o
          const lbl = typeof o === 'object' ? o.label : o
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`h-7 rounded-md text-xs font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lbl}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">¥</span>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder || '0'}
        className={`${baseInput} ${noSpin} pl-6 text-right`}
      />
    </div>
  )
}

/* ── メインコンポーネント ─────────────────────── */
export default function UriageDenpyo({
  master = { offices: [], salesPersons: [], contractors: [] },
  bridge = null,
}) {
  const staffList = master.salesPersons || []
  const officeList = master.offices || []
  const contractorList = master.contractors || []
  const [salesOffice, setSalesOffice] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  /* state */
  const [serviceType, setServiceType] = useState('housing')
  const [issueDate, setIssueDate] = useState(today)
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [officeName, setOfficeName] = useState('')
  const [careManager, setCareManager] = useState('')
  const [customerType, setCustomerType] = useState('new')
  const [billingType, setBillingType] = useState('receipt')
  const [careLevel, setCareLevel] = useState('支援１')
  const [userRatio, setUserRatio] = useState(0.1)
  const [remaining, setRemaining] = useState(DEFAULT_REMAINING.housing)
  const [showBalance, setShowBalance] = useState(false)
  const [items, setItems] = useState([newItem()])
  const [miyakoChecked, setMiyakoChecked] = useState(false)
  const [showExTax, setShowExTax] = useState(true)
  const [staff, setStaff] = useState(() => localStorage.getItem('fukushi_staff') || '')
  const [triedPrint, setTriedPrint] = useState(false)
  const [isSelfPay, setIsSelfPay] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [contractor, setContractor] = useState('')
  const [contractorManual, setContractorManual] = useState(false)
  const [categories, setCategories] = useState([])
  const toggleCategory = (c) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const [shareUrl, setShareUrl] = useState('')
  const [shareMsg, setShareMsg] = useState('')

  /* localStorage 永続化 */
  useEffect(() => { localStorage.setItem('fukushi_staff', staff) }, [staff])

  /* サービス区分変更：明細(金額/仕切り)はクリア、基本情報・属性は維持 */
  useEffect(() => {
    setRemaining(DEFAULT_REMAINING[serviceType] || DEFAULT_REMAINING.housing)
    setMiyakoChecked(false)
    setItems([newItem()])
    if (serviceType !== 'specific') setCategories([])
  }, [serviceType])

  /* 受注簿「特例」セクションからの自動転記（最小限：区分・残高・施工業者のみ） */
  useEffect(() => {
    if (!bridge || !bridge.enabled) return
    if (bridge.serviceType) setServiceType(bridge.serviceType)
    if (typeof bridge.remaining === 'number') setRemaining(bridge.remaining)
    if (typeof bridge.contractor === 'string') setContractor(bridge.contractor)
  }, [bridge])

  /* 共有リンクから状態復元 */
  useEffect(() => {
    const payload = decodePayload(readPayloadFromHash('uriage'))
    const s = payload?.sales
    if (!s) return
    if (s.serviceType) setServiceType(s.serviceType)
    if (s.issueDate) setIssueDate(s.issueDate)
    if (typeof s.salesOffice === 'string') setSalesOffice(s.salesOffice)
    if (typeof s.customerName === 'string') setCustomerName(s.customerName)
    if (typeof s.customerAddress === 'string') setCustomerAddress(s.customerAddress)
    if (typeof s.officeName === 'string') setOfficeName(s.officeName)
    if (typeof s.careManager === 'string') setCareManager(s.careManager)
    if (s.customerType) setCustomerType(s.customerType)
    if (s.billingType) setBillingType(s.billingType)
    if (s.careLevel) setCareLevel(s.careLevel)
    if (typeof s.userRatio === 'number') setUserRatio(s.userRatio)
    if (typeof s.remaining === 'number') setRemaining(s.remaining)
    if (Array.isArray(s.items) && s.items.length) {
      setItems(s.items.map((it) => ({ ...newItem(), ...it })))
    }
    if (typeof s.miyakoChecked === 'boolean') setMiyakoChecked(s.miyakoChecked)
    if (typeof s.showExTax === 'boolean') setShowExTax(s.showExTax)
    if (typeof s.staff === 'string') setStaff(s.staff)
    if (typeof s.isSelfPay === 'boolean') setIsSelfPay(s.isSelfPay)
    if (typeof s.showDetail === 'boolean') setShowDetail(s.showDetail)
    if (typeof s.contractor === 'string') setContractor(s.contractor)
    if (Array.isArray(s.categories)) setCategories(s.categories)
    else if (typeof s.category === 'string' && s.category) setCategories([s.category])
    setShareMsg('共有リンクから内容を読み込みました。')
    setShareUrl(location.href)
  }, [])

  /* 派生値 */
  const hasCost = serviceType === 'housing'
  const filledItems = items.filter((it) => it.amount > 0)
  const filledCount = filledItems.length
  const canMiyako = serviceType === 'specific' && filledCount >= 2
  const applyMiyako = canMiyako && miyakoChecked
  const total = items.reduce((s, it) => s + (it.amount || 0), 0)
  const totalCost = hasCost ? items.reduce((s, it) => s + (it.cost || 0), 0) : 0
  const profit = total - totalCost
  const profitRate = total > 0 ? ((profit / total) * 100).toFixed(1) : '0.0'
  const hasProductInfo = items.some(
    (it) => (it.productName || '').trim() || (it.color || '').trim() || (it.catalog || '').trim()
  )
  const showProductDetail = serviceType === 'specific' && (showDetail || hasProductInfo)

  const calc = useMemo(
    () => calculate({ items, total, remaining, userRatio, miyako: applyMiyako, isSelfPay }),
    [items, total, remaining, userRatio, applyMiyako, isSelfPay]
  )

  const burdenPct = Math.round(userRatio * 10)
  const insurancePct = 10 - burdenPct
  const burdenLabel = `${burdenPct}割`
  const insuranceLabel = `${insurancePct}割`

  /* 明細操作 */
  const updateItem = (id, field, value) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  const removeItem = (id) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.id !== id)))
  const addItem = () => setItems((prev) => [...prev, newItem()])

  /* バリデーション */
  const errors = []
  if (!staff) errors.push('担当者')
  if (!customerName.trim()) errors.push('顧客名')
  const canPrint = errors.length === 0

  /* 印刷 */
  const handlePrint = () => {
    setTriedPrint(true)
    if (canPrint) printDoc('portrait')
  }

  /* 共有リンク・メール・全削除 */
  function snapshotSales() {
    return {
      serviceType, issueDate, salesOffice, customerName, customerAddress, officeName, careManager,
      customerType, billingType, careLevel, userRatio, remaining,
      items, miyakoChecked, showExTax, staff, isSelfPay, showDetail, contractor, categories,
      total, totalUserBurden: calc.totalUserBurden,
    }
  }
  function buildLongShareUrl() {
    const payload = encodePayload({ kind: 'uriage', sales: snapshotSales() })
    return `${location.origin}${location.pathname}#/uriage?payload=${payload}`
  }
  async function copyShareLink() {
    const longUrl = buildLongShareUrl()
    setShareUrl(longUrl)
    const copied = await writeClipboard(longUrl)
    setShareMsg(copied ? '共有URLをクリップボードにコピーしました。' : '共有URLを下に表示しました。')
  }
  function createMail() {
    // メール用は短縮しない長いURLをそのまま使用
    const longUrl = buildLongShareUrl()
    setShareUrl(longUrl)
    const subject = `売上伝票発行のご依頼 ${customerName || ''}`.trim()
    const body = `お疲れ様です。\n下記URLの通り、売上伝票の発行をお願いいたします。\n\n${longUrl}\n`
    location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  function clearAll() {
    if (!window.confirm('入力内容をすべて削除します。よろしいですか？')) return
    setServiceType('housing')
    setIssueDate(today)
    setCustomerName('')
    setCustomerAddress('')
    setOfficeName('')
    setCareManager('')
    setCustomerType('new')
    setBillingType('receipt')
    setCareLevel('支援１')
    setUserRatio(0.1)
    setRemaining(DEFAULT_REMAINING.housing)
    setItems([newItem()])
    setMiyakoChecked(false)
    setShowExTax(false)
    setTriedPrint(false)
    setIsSelfPay(false)
    setShowDetail(false)
    setContractor('')
    setContractorManual(false)
    setCategories([])
    setShareUrl('')
    setSalesOffice('')
    setShareMsg('入力内容を削除しました。')
  }

  /* 計算結果行 */
  const resultRows = [
    ['総合計（税込）', calc.total],
    ...(hasCost ? [['仕切り合計（税込）', totalCost]] : []),
    ['保険対象金額', calc.insuranceCovered],
    ...(calc.excess > 0 ? [['超過分（実費）', calc.excess]] : []),
    [`対象内利用者負担額（${burdenLabel}・切り上げ）`, calc.userBurden],
    [`保険者負担額（${insuranceLabel}・切り下げ）`, calc.insurerBurden],
  ]

  const staffOptions = staffList.filter((n) => (n || '').trim())
  const contractorOptions = contractorList.filter((n) => (n || '').trim())

  /* ── 画面 ─────────────────────────────────── */
  return (
    <>
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-blue-50/30 print:hidden">
      {/* アクションバー */}
      <div className="max-w-[1500px] mx-auto px-4 pt-3">
        {bridge && bridge.enabled && (
          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            販売受注簿の特例入力から自動転記されています（受注簿タブ側で編集できます）
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">操作:</span>
          <button type="button" onClick={createMail} className="h-9 px-3 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50">メール作成</button>
          <button type="button" onClick={copyShareLink} className="h-9 px-3 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50">共有リンク</button>
          <button type="button" onClick={clearAll} className="h-9 px-3 rounded-lg text-xs font-bold border border-red-300 text-red-700 hover:bg-red-50">空白の状態に戻す</button>
          <div className="ml-auto text-xs font-bold text-slate-500">{shareMsg}</div>
        </div>
        {shareUrl && (
          <div className="mt-2 share-box">
            <span className="text-xs font-black text-teal-900">共有URL</span>
            <a className="truncate text-sm font-bold text-teal-950 underline" href={shareUrl}>{shareUrl}</a>
            <button
              className="toggle-button min-h-[36px] px-3 py-1"
              onClick={async () => {
                const ok = await writeClipboard(shareUrl)
                setShareMsg(ok ? '共有URLをコピーしました。' : '共有URLを表示しています。')
              }}
              type="button"
            >コピー</button>
          </div>
        )}
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-[1500px] mx-auto px-4 py-3 grid gap-3 lg:grid-cols-2">
        {/* ── 左カラム ───────────────────────── */}
        <div className="space-y-3">
          {/* サービス区分 */}
          <div className={card}>
            <p className={sectionTitle}>サービス区分</p>
            <OptionRow
              label=""
              options={[
                { value: 'housing', label: '住宅改修' },
                { value: 'specific', label: '特定福祉用具' },
              ]}
              value={serviceType}
              onChange={setServiceType}
              cols="grid-cols-2"
            />
            {serviceType === 'specific' && (
              <div className="mt-3">
                <label className={fieldLabel}>種目（複数選択可）</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {SPECIFIC_CATEGORIES.map((c) => {
                    const active = categories.includes(c)
                    return (
                      <label
                        key={c}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs font-bold cursor-pointer transition ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCategory(c)}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span>{c}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 基本情報 */}
          <div className={card}>
            <p className={sectionTitle}>基本情報</p>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={fieldLabel}>発行日</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className={baseInput}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>営業所</label>
                  <select
                    value={salesOffice}
                    onChange={(e) => setSalesOffice(e.target.value)}
                    className={baseInput}
                  >
                    <option value="">{officeList.length ? '選択' : '（マスタ未登録）'}</option>
                    {officeList.filter((n) => (n || '').trim()).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>営業員 <span className="text-red-400">*</span></label>
                  <select
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                    className={`${baseInput} ${triedPrint && !staff ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                  >
                    <option value="">{staffOptions.length ? '選択' : '（マスタ未登録）'}</option>
                    {staffOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>
                  顧客名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`${baseInput} ${triedPrint && !customerName.trim() ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className={fieldLabel}>住所</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className={baseInput}
                  placeholder="例: 福岡県行橋市..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabel}>居宅名</label>
                  <input
                    type="text"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    className={baseInput}
                    placeholder="居宅事業所名"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>担当ケアマネージャー</label>
                  <input
                    type="text"
                    value={careManager}
                    onChange={(e) => setCareManager(e.target.value)}
                    className={baseInput}
                    placeholder="ケアマネ名"
                  />
                </div>
              </div>
              {/* 施工業者（住宅改修のみ） */}
              {serviceType === 'housing' && (
                <div>
                  <label className={fieldLabel}>施工業者</label>
                  <input
                    type="text"
                    list="uriage-contractor-list"
                    value={contractor}
                    onChange={(e) => setContractor(e.target.value)}
                    placeholder={contractorList.length ? '入力 / 候補から選択' : '施工業者名を入力'}
                    className={baseInput}
                  />
                  <datalist id="uriage-contractor-list">
                    {contractorList.filter((n) => (n || '').trim()).map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          </div>

          {/* 属性 */}
          <div className={card}>
            <p className={sectionTitle}>属性</p>
            <div className="space-y-2">
              <OptionRow
                label="顧客区分"
                options={[
                  { value: 'new', label: '新規' },
                  { value: 'existing', label: '既存' },
                ]}
                value={customerType}
                onChange={setCustomerType}
                cols="grid-cols-2"
              />
              <OptionRow
                label="請求区分"
                options={[
                  { value: 'receipt', label: '受領委任払い' },
                  { value: 'reimbursement', label: '償還払い' },
                ]}
                value={billingType}
                onChange={setBillingType}
                cols="grid-cols-2"
              />
              <OptionRow
                label="介護度"
                options={CARE_LEVELS}
                value={careLevel}
                onChange={setCareLevel}
                cols="grid-cols-7"
              />
              <OptionRow
                label="負担割合"
                options={[
                  { value: 0.1, label: '1割' },
                  { value: 0.2, label: '2割' },
                  { value: 0.3, label: '3割' },
                ]}
                value={userRatio}
                onChange={setUserRatio}
                cols="grid-cols-3"
              />
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="selfpay"
                  checked={isSelfPay}
                  onChange={(e) => setIsSelfPay(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="selfpay" className="text-xs text-slate-600">全額自費</label>
              </div>
            </div>
          </div>

          {/* 介護保険残高（任意・超過しそうな時のみ） */}
          <div className={card}>
            <div className="flex items-center justify-between mb-1">
              <p className={`${sectionTitle} mb-0`}>介護保険残高</p>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">任意</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2 leading-snug">
              ※ 介護保険の支給限度額を<strong className="text-slate-700">超過しそうな場合のみ</strong>入力してください。通常は未入力で構いません。
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-slate-500">¥</span>
              <input
                type="number"
                value={remaining || ''}
                onChange={(e) => setRemaining(Number(e.target.value) || 0)}
                placeholder="超過しそうな時のみ入力"
                className={`${baseInput} ${noSpin} h-14 pl-8 pr-3 text-right text-3xl font-extrabold tracking-tight`}
              />
            </div>
          </div>
        </div>

        {/* ── 右カラム ───────────────────────── */}
        <div className="space-y-3">
          {/* 明細 */}
          <div className={card}>
            <div className="flex items-center justify-between mb-2">
              <p className={`${sectionTitle} mb-0`}>明細</p>
              {serviceType === 'specific' && (
                <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDetail}
                    onChange={(e) => setShowDetail(e.target.checked)}
                    className="rounded"
                  />
                  商品詳細を表示
                </label>
              )}
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-5 text-right">{i + 1}</span>
                    {hasCost ? (
                      <div className="flex-1 grid grid-cols-2 gap-1">
                        <MoneyInput
                          value={item.amount}
                          onChange={(v) => updateItem(item.id, 'amount', v)}
                          placeholder="金額"
                        />
                        <MoneyInput
                          value={item.cost}
                          onChange={(v) => updateItem(item.id, 'cost', v)}
                          placeholder="仕切り"
                        />
                      </div>
                    ) : (
                      <div className="w-40">
                        <MoneyInput
                          value={item.amount}
                          onChange={(v) => updateItem(item.id, 'amount', v)}
                          placeholder="金額"
                        />
                      </div>
                    )}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 rounded-lg text-xs text-red-400 hover:bg-red-50 transition flex-shrink-0"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {/* 商品詳細（特定福祉用具 & showDetail時のみ）：商品名・カラーのみ */}
                  {serviceType === 'specific' && showDetail && (
                    <div className="ml-6 grid grid-cols-[3fr_1fr] gap-1">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                        placeholder="商品名"
                        className={`${baseInput} text-[11px] h-7`}
                      />
                      <input
                        type="text"
                        value={item.color}
                        onChange={(e) => updateItem(item.id, 'color', e.target.value)}
                        placeholder="カラー"
                        className={`${baseInput} text-[11px] h-7`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
            >
              ＋ 明細追加
            </button>

            {/* 個別切り上げチェック */}
            {canMiyako && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                <input
                  type="checkbox"
                  id="miyako"
                  checked={miyakoChecked}
                  onChange={(e) => setMiyakoChecked(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="miyako" className="text-xs text-amber-700">
                  個別切り上げ（各明細ごとに利用者負担を切り上げ）
                </label>
              </div>
            )}
          </div>

          {/* 仕切り合計（住宅改修のみ） */}
          {hasCost && total > 0 && (
            <div className={card}>
              <p className={sectionTitle}>仕切り・利益</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-400">仕切り合計</p>
                  <p className="text-sm font-semibold text-slate-700">{fmt(totalCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">利益金額</p>
                  <p className="text-sm font-semibold text-slate-700">{fmt(profit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">利益率</p>
                  <p className="text-sm font-semibold text-slate-700">{profitRate}%</p>
                </div>
              </div>
            </div>
          )}

          {/* 計算結果 */}
          <div className={card}>
            <div className="flex items-center justify-between mb-2">
              <p className={`${sectionTitle} mb-0`}>計算結果</p>
              <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExTax}
                  onChange={(e) => setShowExTax(e.target.checked)}
                  className="rounded"
                />
                税抜表示
              </label>
            </div>
            <table className="w-full text-sm">
              {showExTax && (
                <thead>
                  <tr className="text-[10px] text-slate-400">
                    <th className="text-left font-normal pb-1">項目</th>
                    <th className="text-right font-normal pb-1 w-24">税込</th>
                    <th className="text-right font-normal pb-1 w-24">税抜</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {resultRows.map(([label, val]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <td className="py-1 text-xs text-slate-600">{label}</td>
                    <td className="py-1 text-right font-medium text-slate-800 w-24">{fmt(val)}</td>
                    {showExTax && (
                      <td className="py-1 text-right text-slate-500 w-24">{fmt(exTax(val))}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 合計パネル */}
          <div className="bg-blue-600 text-white rounded-xl p-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ご利用者お支払い合計</span>
              <span className="text-xl font-bold">{fmt(calc.totalUserBurden)}</span>
            </div>
            {showExTax && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-blue-200">税抜</span>
                <span className="text-sm text-blue-100">{fmt(exTax(calc.totalUserBurden))}</span>
              </div>
            )}
          </div>

          {/* エラー表示 & 印刷ボタン */}
          {triedPrint && !canPrint && (
            <p className="text-xs text-red-500">未入力: {errors.join('、')}</p>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow transition"
          >
            印刷
          </button>
        </div>
      </main>
    </div>

    {/* ── 印刷シート（親の外） ──────────────────── */}
    <div className="uriage-print hidden print:block p-0 text-[13px] leading-[1.5]">
      {/* 印刷ヘッダー */}
      <div className="text-center mb-4">
        <p className="text-xs text-slate-500">{salesOffice}</p>
        <h1 className="text-base font-bold mt-1">売上伝票発行依頼書</h1>
      </div>

      {/* 基本情報テーブル */}
      <table className="w-full table-fixed border-collapse border border-slate-500 mb-3">
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '32%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">サービス区分</th>
            <td className="border border-slate-500 px-2 py-1">
              {serviceType === 'housing' ? '住宅改修' : '特定福祉用具'}
            </td>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">発行日</th>
            <td className="border border-slate-500 px-2 py-1">{issueDate}</td>
          </tr>
          {serviceType === 'specific' && (
            <tr>
              <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">種目</th>
              <td className="border border-slate-500 px-2 py-1" colSpan={3}>{categories.join('、')}</td>
            </tr>
          )}
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">担当者</th>
            <td className="border border-slate-500 px-2 py-1">{staff}</td>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">顧客区分</th>
            <td className="border border-slate-500 px-2 py-1">{customerType === 'new' ? '新規' : '既存'}</td>
          </tr>
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">顧客名</th>
            <td className="border border-slate-500 px-2 py-1" colSpan={3}>{customerName}</td>
          </tr>
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">住所</th>
            <td className="border border-slate-500 px-2 py-1" colSpan={3}>{customerAddress}</td>
          </tr>
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">居宅名</th>
            <td className="border border-slate-500 px-2 py-1">{officeName}</td>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">担当ケアマネージャー</th>
            <td className="border border-slate-500 px-2 py-1">{careManager}</td>
          </tr>
          {serviceType === 'housing' && (
            <tr>
              <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">施工業者</th>
              <td className="border border-slate-500 px-2 py-1" colSpan={3}>{contractor}</td>
            </tr>
          )}
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">請求区分</th>
            <td className="border border-slate-500 px-2 py-1">
              {billingType === 'receipt' ? '受領委任払い' : '償還払い'}
            </td>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">介護度</th>
            <td className="border border-slate-500 px-2 py-1">{careLevel}</td>
          </tr>
          <tr>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">負担割合</th>
            <td className="border border-slate-500 px-2 py-1">{burdenLabel}</td>
            <th className="border border-slate-500 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-tight">介護保険残額</th>
            <td className="border border-slate-500 px-2 py-1">{fmt(remaining)}</td>
          </tr>
        </tbody>
      </table>

      {/* 明細テーブル */}
      <table className="w-full table-fixed border-collapse border border-slate-500 mb-3">
        <colgroup>
          <col style={{ width: '6%' }} />
          {showProductDetail && (
            <>
              <col style={{ width: '28%' }} />
              <col style={{ width: '14%' }} />
            </>
          )}
          <col />
          {showExTax && <col />}
          {hasCost && <col />}
          {hasCost && showExTax && <col />}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-500 px-1.5 py-1 text-center">No</th>
            {showProductDetail && (
              <>
                <th className="border border-slate-500 px-1.5 py-1 text-left">商品名</th>
                <th className="border border-slate-500 px-1.5 py-1 text-left">カラー</th>
              </>
            )}
            <th className="border border-slate-500 px-1.5 py-1 text-right">{hasCost ? '工事合計金額(税込)' : '金額(税込)'}</th>
            {showExTax && <th className="border border-slate-500 px-1.5 py-1 text-right" style={hasCost ? { background: '#fff3a8' } : undefined}>{hasCost ? '工事合計金額(税抜)' : '金額(税抜)'}</th>}
            {hasCost && <th className="border border-slate-500 px-1.5 py-1 text-right">工事金額仕切り(税込)</th>}
            {hasCost && showExTax && <th className="border border-slate-500 px-1.5 py-1 text-right" style={{ background: '#fff3a8' }}>工事金額仕切り(税抜)</th>}
          </tr>
        </thead>
        <tbody>
          {items.filter((it) => it.amount > 0).map((item, i) => (
            <tr key={item.id}>
              <td className="border border-slate-500 px-1.5 py-1 text-center align-top">{i + 1}</td>
              {showProductDetail && (
                <>
                  <td className="border border-slate-500 px-1.5 py-1 align-top break-words">{item.productName}</td>
                  <td className="border border-slate-500 px-1.5 py-1 align-top break-words">{item.color}</td>
                </>
              )}
              <td className="border border-slate-500 px-1.5 py-1 text-right align-top">{fmt(item.amount)}</td>
              {showExTax && (
                <td className="border border-slate-500 px-1.5 py-1 text-right align-top" style={hasCost ? { background: '#fff3a8' } : undefined}>{fmt(exTax(item.amount))}</td>
              )}
              {hasCost && (
                <td className="border border-slate-500 px-1.5 py-1 text-right align-top">{fmt(item.cost)}</td>
              )}
              {hasCost && showExTax && (
                <td className="border border-slate-500 px-1.5 py-1 text-right align-top" style={{ background: '#fff3a8' }}>{fmt(exTax(item.cost))}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 仕切り合計（住宅改修のみ）— 利益金額/利益率はハイライト */}
      {hasCost && total > 0 && (
        <div
          className="mb-3 px-2 py-1.5 text-xs inline-block font-bold"
          style={{ background: '#fff3a8', border: '1.2px solid #000' }}
        >
          <span className="mr-4">仕切り合計: {fmt(totalCost)}</span>
          <span className="mr-4">利益金額: {fmt(profit)}</span>
          <span>利益率: {profitRate}%</span>
        </div>
      )}

      {/* 個別切り上げ表示 */}
      {applyMiyako && (
        <p className="text-xs text-slate-600 mb-2">※ 個別切り上げ適用</p>
      )}

      {/* 計算結果テーブル */}
      <table className="w-full table-fixed border-collapse border border-slate-500 mb-3">
        <colgroup>
          <col />
          <col style={{ width: '25%' }} />
          {showExTax && <col style={{ width: '25%' }} />}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-500 px-2 py-1 text-left">項目</th>
            <th className="border border-slate-500 px-2 py-1 text-right">税込</th>
            {showExTax && <th className="border border-slate-500 px-2 py-1 text-right">税抜</th>}
          </tr>
        </thead>
        <tbody>
          {resultRows.map(([label, val]) => {
            const highlight = label.includes('利用者負担額') || label.includes('保険者負担額')
            const hlStyle = highlight ? { background: '#fff3a8' } : undefined
            return (
              <tr key={label}>
                <td className="border border-slate-500 px-2 py-1" style={hlStyle}>{label}</td>
                <td className="border border-slate-500 px-2 py-1 text-right" style={hlStyle}>{fmt(val)}</td>
                {showExTax && (
                  <td className="border border-slate-500 px-2 py-1 text-right" style={hlStyle}>{fmt(exTax(val))}</td>
                )}
              </tr>
            )
          })}
          <tr className="border border-slate-500 bg-blue-50 font-bold">
            <td className="border border-slate-500 px-2 py-1">ご利用者お支払い合計</td>
            <td className="border border-slate-500 px-2 py-1 text-right">{fmt(calc.totalUserBurden)}</td>
            {showExTax && (
              <td className="border border-slate-500 px-2 py-1 text-right">{fmt(exTax(calc.totalUserBurden))}</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
    </>
  )
}
