// 販売受注簿の「特例」セクション。住宅改修・特定福祉用具の場合に追加入力するエリア。
// ここで入力した値は売上伝票発行依頼書に自動転記される（橋渡し state は App.jsx が保持）。

const CARE_LEVELS = ['支援１', '支援２', '介護１', '介護２', '介護３', '介護４', '介護５']
const DEFAULT_REMAINING = { housing: 200000, specific: 100000 }

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
  const patch = (k, v) => setBridge({ ...bridge, [k]: v })
  const items = Array.isArray(bridge.items) && bridge.items.length ? bridge.items : [{ id: 1, amount: 0, cost: 0 }]
  const updateItem = (i, k, v) =>
    patch('items', items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)))
  const addItem = () => patch('items', [...items, { id: Date.now(), amount: 0, cost: 0 }])
  const removeItem = (i) =>
    patch('items', items.length <= 1 ? items : items.filter((_, idx) => idx !== i))
  const hasCost = bridge.serviceType === 'housing'
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* サービス区分 */}
      <div className="col-span-12 md:col-span-4">
        <span className="field-label">サービス区分</span>
        <ToggleButtons
          options={[{ value: 'housing', label: '住宅改修' }, { value: 'specific', label: '特定福祉用具' }]}
          value={bridge.serviceType}
          onChange={(v) =>
            setBridge({
              ...bridge,
              serviceType: v,
              remaining: DEFAULT_REMAINING[v],
              items: [{ id: Date.now(), amount: 0, cost: 0 }],
            })
          }
        />
      </div>

      {/* 介護保険残高 */}
      <div className="col-span-12 md:col-span-4">
        <span className="field-label">介護保険残高</span>
        <input
          type="number"
          className="input h-11 text-right text-lg font-extrabold"
          value={bridge.remaining || ''}
          onChange={(e) => patch('remaining', Number(e.target.value) || 0)}
        />
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

      {/* 明細 */}
      <div className="col-span-12">
        <span className="field-label">明細（金額{hasCost ? '／仕切り' : ''}）</span>
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={it.id || i} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-6 text-right">{i + 1}.</span>
              <input
                type="number"
                placeholder="金額"
                value={it.amount || ''}
                className="input h-9 max-w-[200px] text-right"
                onChange={(e) => updateItem(i, 'amount', Number(e.target.value) || 0)}
              />
              {hasCost && (
                <input
                  type="number"
                  placeholder="仕切り"
                  value={it.cost || ''}
                  className="input h-9 max-w-[200px] text-right"
                  onChange={(e) => updateItem(i, 'cost', Number(e.target.value) || 0)}
                />
              )}
              <span className="ml-2 text-xs text-slate-500">
                合計: <span className="font-extrabold text-slate-700">{fmtYen(total)}</span>
              </span>
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
        <button type="button" onClick={addItem} className="mt-1 text-xs text-blue-600 hover:text-blue-800">
          ＋ 明細追加
        </button>
      </div>

      {/* 顧客区分・請求区分・全額自費 を 1 行に */}
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
