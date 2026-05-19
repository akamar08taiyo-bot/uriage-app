import { useState, useEffect, useMemo } from 'react'
import { printDoc } from '../print.js'

/* ── 定数 ─────────────────────────────────── */
const DEFAULT_REMAINING = { housing: 200000, specific: 100000 }
const CARE_LEVELS = ['支援１', '支援２', '介護１', '介護２', '介護３', '介護４', '介護５']
const CATALOGS = ['ケアマックス', 'ウェルファン']
const TAX = 1.1

let _seq = 0
const newItem = () => ({ id: ++_seq, amount: 0, cost: 0, catalog: 'ケアマックス', productName: '', color: '' })
const fmt = (n) => `¥${Math.round(n || 0).toLocaleString()}`
const exTax = (n) => Math.round((n || 0) / TAX)

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
export default function UriageDenpyo({ staffList = [], officeMaster = '', contractorList = [] }) {
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
  const [careLevel, setCareLevel] = useState('介護１')
  const [userRatio, setUserRatio] = useState(0.1)
  const [remaining, setRemaining] = useState(DEFAULT_REMAINING.housing)
  const [showBalance, setShowBalance] = useState(false)
  const [items, setItems] = useState([newItem()])
  const [miyakoChecked, setMiyakoChecked] = useState(false)
  const [showExTax, setShowExTax] = useState(false)
  const [staff, setStaff] = useState(() => localStorage.getItem('fukushi_staff') || '')
  const [triedPrint, setTriedPrint] = useState(false)
  const [isSelfPay, setIsSelfPay] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [contractor, setContractor] = useState('')
  const [contractorManual, setContractorManual] = useState(false)

  /* localStorage 永続化 */
  useEffect(() => { localStorage.setItem('fukushi_staff', staff) }, [staff])

  /* サービス区分変更 */
  useEffect(() => {
    setRemaining(DEFAULT_REMAINING[serviceType] || DEFAULT_REMAINING.housing)
    setMiyakoChecked(false)
  }, [serviceType])

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

  /* 計算結果行 */
  const resultRows = [
    ['総合計', calc.total],
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
      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-3 grid gap-3 lg:grid-cols-2">
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
          </div>

          {/* 基本情報 */}
          <div className={card}>
            <p className={sectionTitle}>基本情報</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
                  <label className={fieldLabel}>
                    担当者 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                    className={`${baseInput} ${triedPrint && !staff ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                  >
                    <option value="">選択</option>
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
                  <select
                    value={contractorManual ? '__other__' : contractor}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '__other__') {
                        setContractorManual(true)
                        setContractor('')
                      } else {
                        setContractorManual(false)
                        setContractor(v)
                      }
                    }}
                    className={baseInput}
                  >
                    <option value="">選択</option>
                    {contractorOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                    <option value="__other__">その他（手入力）</option>
                  </select>
                  {contractorManual && (
                    <input
                      type="text"
                      value={contractor}
                      onChange={(e) => setContractor(e.target.value)}
                      placeholder="施工業者名を入力"
                      className={`${baseInput} mt-1`}
                    />
                  )}
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

          {/* 介護保険残額 */}
          <div className={card}>
            <button
              type="button"
              onClick={() => setShowBalance((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <p className={`${sectionTitle} mb-0`}>介護保険残額</p>
              <span className="text-xs text-slate-400">{showBalance ? '▲' : '▼'}</span>
            </button>
            {showBalance && (
              <div className="mt-2">
                <MoneyInput value={remaining} onChange={setRemaining} />
              </div>
            )}
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
                  {/* 商品詳細（特定福祉用具 & showDetail時のみ） */}
                  {serviceType === 'specific' && showDetail && (
                    <div className="ml-6 grid grid-cols-[1.4fr_3fr_1fr] gap-1">
                      <div className="space-y-1">
                        <select
                          value={CATALOGS.includes(item.catalog) ? item.catalog : 'その他'}
                          onChange={(e) =>
                            updateItem(item.id, 'catalog', e.target.value === 'その他' ? '' : e.target.value)
                          }
                          className={`${baseInput} text-[11px] h-7`}
                        >
                          {CATALOGS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="その他">その他（手入力）</option>
                        </select>
                        {!CATALOGS.includes(item.catalog) && (
                          <input
                            type="text"
                            value={item.catalog}
                            onChange={(e) => updateItem(item.id, 'catalog', e.target.value)}
                            placeholder="カタログ名を入力"
                            className={`${baseInput} text-[11px] h-7`}
                          />
                        )}
                      </div>
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
    <div className="uriage-print hidden print:block p-0 text-[11px]">
      {/* 印刷ヘッダー */}
      <div className="text-center mb-4">
        <p className="text-xs text-slate-500">{officeMaster}</p>
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
          <col style={{ width: '8%' }} />
          {showProductDetail && (
            <>
              <col style={{ width: '16%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '12%' }} />
            </>
          )}
          <col />
          <col />
          {hasCost && <col />}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-500 px-1.5 py-1 text-center">No</th>
            {showProductDetail && (
              <>
                <th className="border border-slate-500 px-1.5 py-1 text-left">カタログ</th>
                <th className="border border-slate-500 px-1.5 py-1 text-left">商品名</th>
                <th className="border border-slate-500 px-1.5 py-1 text-left">カラー</th>
              </>
            )}
            <th className="border border-slate-500 px-1.5 py-1 text-right">金額(税込)</th>
            <th className="border border-slate-500 px-1.5 py-1 text-right">金額(税抜)</th>
            {hasCost && <th className="border border-slate-500 px-1.5 py-1 text-right">仕切り(税込)</th>}
          </tr>
        </thead>
        <tbody>
          {items.filter((it) => it.amount > 0).map((item, i) => (
            <tr key={item.id}>
              <td className="border border-slate-500 px-1.5 py-1 text-center align-top">{i + 1}</td>
              {showProductDetail && (
                <>
                  <td className="border border-slate-500 px-1.5 py-1 align-top break-words">{item.catalog}</td>
                  <td className="border border-slate-500 px-1.5 py-1 align-top break-words">{item.productName}</td>
                  <td className="border border-slate-500 px-1.5 py-1 align-top break-words">{item.color}</td>
                </>
              )}
              <td className="border border-slate-500 px-1.5 py-1 text-right align-top">{fmt(item.amount)}</td>
              <td className="border border-slate-500 px-1.5 py-1 text-right align-top">{fmt(exTax(item.amount))}</td>
              {hasCost && (
                <td className="border border-slate-500 px-1.5 py-1 text-right align-top">{fmt(item.cost)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 仕切り合計（住宅改修のみ） */}
      {hasCost && total > 0 && (
        <div className="mb-3 text-xs">
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
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-500 px-2 py-1 text-left">項目</th>
            <th className="border border-slate-500 px-2 py-1 text-right">税込</th>
            <th className="border border-slate-500 px-2 py-1 text-right">税抜</th>
          </tr>
        </thead>
        <tbody>
          {resultRows.map(([label, val]) => (
            <tr key={label}>
              <td className="border border-slate-500 px-2 py-1">{label}</td>
              <td className="border border-slate-500 px-2 py-1 text-right">{fmt(val)}</td>
              <td className="border border-slate-500 px-2 py-1 text-right">{fmt(exTax(val))}</td>
            </tr>
          ))}
          <tr className="border border-slate-500 bg-blue-50 font-bold">
            <td className="border border-slate-500 px-2 py-1">ご利用者お支払い合計</td>
            <td className="border border-slate-500 px-2 py-1 text-right">{fmt(calc.totalUserBurden)}</td>
            <td className="border border-slate-500 px-2 py-1 text-right">{fmt(exTax(calc.totalUserBurden))}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </>
  )
}
