// 販売受注簿の「特例」セクション。住宅改修・特定福祉用具の場合に最小限のフラグだけ立てる。
// 属性・明細などは売上伝票発行依頼書タブで通常入力する。

const DEFAULT_REMAINING = { housing: 200000, specific: 100000 }

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
            })
          }
        />
      </div>

      {/* 介護保険残高（任意・超過しそうな時のみ） */}
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

      <p className="col-span-12 text-[11px] text-slate-500 leading-snug">
        ※ 明細・顧客区分・請求区分・介護度・負担割合・全額自費は
        <strong className="text-slate-700">「売上伝票発行依頼書」タブ</strong>
        で入力してください（デフォルト：新規 / 受領委任払い / 要支援1 / 1割負担）。
      </p>
    </div>
  )
}
