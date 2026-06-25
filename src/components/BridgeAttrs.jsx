// 販売受注簿の「特例」セクション。売上伝票発行依頼書と同じ内容を保持・編集する。
// ここで入力した値は売上伝票発行依頼書タブに自動転記され、また逆方向（売上伝票→受注簿）も同期する。

const CARE_LEVELS = ['支援１', '支援２', '介護１', '介護２', '介護３', '介護４', '介護５']
const DEFAULT_REMAINING = { housing: 200000, specific: 100000 }
const SPECIFIC_CATEGORIES = [
  'シャワーチェア',
  '浴槽手すり',
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
const fmtYen = (n) => `¥${Math.round(Number(n) || 0).toLocaleString('ja-JP')}`

function ToggleButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        return (
          <button
            key={String(v)}
            type="button"
            className={`toggle-button ${value === v ? 'active' : ''}`}
            onClick={() => onChange(v)}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export default function BridgeAttrs({ bridge, setBridge }) {
  // 関数形 setBridge で古い closure 値を回避（連続更新時の取りこぼし防止）
  const patch = (k, v) => setBridge((prev) => (prev ? { ...prev, [k]: v } : prev))
  const items = Array.isArray(bridge.items) && bridge.items.length
    ? bridge.items
    : [{ id: 1, amount: 0, cost: 0, productName: '', color: '' }]
  const updateItem = (i, k, v) =>
    setBridge((prev) => {
      if (!prev) return prev
      const cur = Array.isArray(prev.items) && prev.items.length ? prev.items : items
      return { ...prev, items: cur.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }
    })
  const addItem = () =>
    setBridge((prev) => {
      if (!prev) return prev
      const cur = Array.isArray(prev.items) ? prev.items : []
      return { ...prev, items: [...cur, { id: Date.now(), amount: 0, cost: 0, productName: '', color: '' }] }
    })
  const removeItem = (i) =>
    setBridge((prev) => {
      if (!prev) return prev
      const cur = Array.isArray(prev.items) ? prev.items : []
      return { ...prev, items: cur.length <= 1 ? cur : cur.filter((_, idx) => idx !== i) }
    })
  const hasCost = bridge.serviceType === 'housing'
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const categories = Array.isArray(bridge.categories) ? bridge.categories : []
  const toggleCategory = (c) =>
    setBridge((prev) => {
      if (!prev) return prev
      const cur = Array.isArray(prev.categories) ? prev.categories : []
      return { ...prev, categories: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] }
    })

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* サービス区分 */}
      <div className="col-span-12 md:col-span-4">
        <span className="field-label">サービス区分</span>
        <ToggleButtons
          options={[{ value: 'housing', label: '住宅改修' }, { value: 'specific', label: '特定福祉用具' }]}
          value={bridge.serviceType}
          onChange={(v) =>
            setBridge((prev) =>
              prev
                ? {
                    ...prev,
                    serviceType: v,
                    remaining: DEFAULT_REMAINING[v],
                    items: [{ id: Date.now(), amount: 0, cost: 0, productName: '', color: '' }],
                    categories: v === 'specific' ? (prev.categories || []) : [],
                  }
                : prev,
            )
          }
        />
      </div>

      {/* 介護保険残高 */}
      <div className="col-span-12 md:col-span-4">
        <div className="flex items-center justify-between">
          <span className="field-label">介護保険残高</span>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">任意</span>
        </div>
        <input
          type="number"
          className="input h-11 text-right text-lg font-extrabold"
          value={bridge.remaining || ''}
          placeholder="超過しそうな時のみ入力"
          onChange={(e) => patch('remaining', Number(e.target.value) || 0)}
        />
        <p className="mt-1 text-[10px] text-slate-500 leading-snug">
          ※ 支給限度額を超過しそうな場合のみ入力（通常は未入力でOK）
        </p>
      </div>

      {/* 施工業者（住宅改修のみ） */}
      <div className="col-span-12 md:col-span-4">
        {bridge.serviceType === 'housing' ? (
          <>
            <span className="field-label">施工業者</span>
            <input
              type="text"
              className="input h-11"
              value={bridge.contractor || ''}
              placeholder="施工業者名"
              onChange={(e) => patch('contractor', e.target.value)}
            />
          </>
        ) : null}
      </div>

      {/* 種目（特定福祉用具のみ、複数選択） */}
      {bridge.serviceType === 'specific' && (
        <div className="col-span-12">
          <span className="field-label">種目（複数選択可）</span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {SPECIFIC_CATEGORIES.map((c) => {
              const active = categories.includes(c)
              return (
                <label
                  key={c}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs font-bold cursor-pointer transition ${
                    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
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

      {/* 明細 */}
      <div className="col-span-12">
        <span className="field-label">
          明細（金額{hasCost ? '／仕切り' : ''}
          {bridge.serviceType === 'specific' ? ' ／ 商品名 ／ カラー' : ''}）
        </span>
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={it.id || i} className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 w-6 text-right">{i + 1}.</span>
              <input
                type="number"
                placeholder="金額"
                value={it.amount || ''}
                className="input h-9 max-w-[160px] text-right"
                onChange={(e) => updateItem(i, 'amount', Number(e.target.value) || 0)}
              />
              {hasCost && (
                <input
                  type="number"
                  placeholder="仕切り"
                  value={it.cost || ''}
                  className="input h-9 max-w-[160px] text-right"
                  onChange={(e) => updateItem(i, 'cost', Number(e.target.value) || 0)}
                />
              )}
              {bridge.serviceType === 'specific' && (
                <>
                  <input
                    type="text"
                    placeholder="商品名"
                    value={it.productName || ''}
                    className="input h-9 max-w-[220px]"
                    onChange={(e) => updateItem(i, 'productName', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="カラー"
                    value={it.color || ''}
                    className="input h-9 max-w-[120px]"
                    onChange={(e) => updateItem(i, 'color', e.target.value)}
                  />
                </>
              )}
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="ml-auto h-8 w-8 text-red-400 hover:bg-red-50 rounded"
                >×</button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-800">
            ＋ 明細追加
          </button>
          <span className="text-xs text-slate-500">
            合計: <span className="font-extrabold text-slate-700">{fmtYen(total)}</span>
          </span>
        </div>
      </div>

      {/* 顧客区分・請求区分・全額自費 */}
      <div className="col-span-12 md:col-span-4">
        <span className="field-label">顧客区分</span>
        <ToggleButtons
          options={[{ value: 'new', label: '新規' }, { value: 'existing', label: '既存' }]}
          value={bridge.customerType}
          onChange={(v) => patch('customerType', v)}
        />
      </div>
      <div className="col-span-12 md:col-span-5">
        <span className="field-label">請求区分</span>
        <ToggleButtons
          options={[{ value: 'receipt', label: '受領委任払い' }, { value: 'reimbursement', label: '償還払い' }]}
          value={bridge.billingType}
          onChange={(v) => patch('billingType', v)}
        />
      </div>
      <div className="col-span-12 md:col-span-3 flex items-end">
        <label className="check-tile inline-flex items-center gap-2 w-full justify-center">
          <input
            type="checkbox"
            checked={Boolean(bridge.isSelfPay)}
            onChange={(e) => patch('isSelfPay', e.target.checked)}
          />
          <span>全額自費</span>
        </label>
      </div>

      {/* 介護度 */}
      <div className="col-span-12">
        <span className="field-label">介護度</span>
        <ToggleButtons options={CARE_LEVELS} value={bridge.careLevel} onChange={(v) => patch('careLevel', v)} />
      </div>

      {/* 負担割合 */}
      <div className="col-span-12">
        <span className="field-label">負担割合</span>
        <ToggleButtons
          options={[
            { value: 0.1, label: '1割' },
            { value: 0.2, label: '2割' },
            { value: 0.3, label: '3割' },
          ]}
          value={bridge.userRatio}
          onChange={(v) => patch('userRatio', v)}
        />
      </div>
    </div>
  )
}
