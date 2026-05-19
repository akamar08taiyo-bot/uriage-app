import { useEffect, useMemo, useState } from 'react'
import { printDoc } from '../print.js'

/* ── 定数 ─────────────────────────────────── */
const orderTypes = ['販売', '給付', '在庫', '受領委任', '償還']
const stockTypes = ['有', '移動', '発注(自社・直送)']
const catalogTypes = ['介援隊', '夢ライフ', 'ALL LIFE', '他']
const catalogLinks = [
  {
    label: 'ケアマックスカタログ',
    href: 'https://catalog.kaientai.cc/iportal/CatalogViewInterfaceStartUpAction.do?method=startUp&mode=PAGE&catalogCategoryId=&catalogId=4071630000&pageGroupId=1&volumeID=CMC00008&keyword=&categoryID=&sortMode=&sortKey=&sortOrder=&designID=&designConfirmFlg=',
  },
  {
    label: 'ウェルファンカタログ',
    href: 'https://www.smart-benrichou.jp/m/home#id=68a81774-6264-464d-ab7f-387cac100017&page=68a817a8-38a4-4eda-9b89-5ce6ac100017',
  },
  {
    label: 'ALL LIFE カタログ',
    href: 'https://my.ebook5.net/ALLLIFE/MmwdEF/',
  },
]
const checklistOptions = [
  '理由書',
  '写真(事前･事後)',
  '見積書',
  '図面',
  '領収証',
  '委任状(受領委任の場合)',
  'カタログのコピー',
  '同意書(所有者別)',
]

const blankItem = () => ({
  productName: '',
  modelNumber: '',
  colorSize: '',
  quantity: '',
  unit: '',
  unitPrice: '',
})

const blankOrder = () => ({
  orderDateYear: '',
  orderDateMonth: '',
  orderDateDay: '',
  orderType: '販売',
  salesRepName: '',
  requester: '',
  customerName: '',
  customerKana: '',
  addressTel: '',
  deliveryDate: '',
  salesDate: '',
  salesSlipNumber: '',
  items: [blankItem()],
  orderNumber: '',
  stockArrivalType: '有',
  supplierOrMoveFrom: '',
  purchaseOrderNumber: '',
  orderer: '',
  arrivalDate: '',
  arrivalConfirmed: false,
  catalog: '介援隊',
  catalogOtherDetail: '',
  catalogVol: '',
  catalogPage: '',
  catalogOrderCode: '',
  benefitAmount: '',
  checklist: [],
})

const numberValue = (value) => Number(String(value || '').replace(/,/g, '')) || 0
const yen = (value) => new Intl.NumberFormat('ja-JP').format(Math.round(value || 0))
const makeId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function encodePayload(payload) {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodePayload(value) {
  if (!value) return null
  try {
    const base64 =
      value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function readSharedPayload() {
  const hash = location.hash || ''
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return ''
  return new URLSearchParams(hash.slice(qIndex + 1)).get('payload') || ''
}

function normalizeOrder(source = {}) {
  const base = blankOrder()
  return {
    ...base,
    ...source,
    customerName: source.customerName ?? '',
    customerKana: source.customerKana ?? '',
    items: source.items?.length ? source.items : [blankItem()],
    catalogOrderCode: source.catalogOrderCode ?? '',
    checklist: Array.isArray(source.checklist) ? source.checklist : [],
    arrivalConfirmed: Boolean(source.arrivalConfirmed),
  }
}

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem('juchu_orders') || '{}')
  } catch {
    return {}
  }
}

async function shortenUrl(longUrl) {
  // is.gd は長すぎる URL を拒否する事があるため、ダメなら TinyURL へフォールバック。
  try {
    const r = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`)
    if (r.ok) {
      const t = (await r.text()).trim()
      if (/^https?:\/\//.test(t)) return t
    }
  } catch {}
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`)
    if (r.ok) {
      const t = (await r.text()).trim()
      if (/^https?:\/\//.test(t)) return t
    }
  } catch {}
  return longUrl
}

function saveOrderLocal(order, id) {
  const orderId = id || makeId()
  const all = loadOrders()
  all[orderId] = { ...order, id: orderId, updatedAt: new Date().toISOString() }
  localStorage.setItem('juchu_orders', JSON.stringify(all))
  return orderId
}

/* ── 小コンポーネント ─────────────────────────── */
function Field({ label, children, className = '' }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function ToggleGroup({ value, options, onChange, emptyText }) {
  if (!options.length && emptyText) {
    return (
      <div className="min-h-[44px] rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
        {emptyText}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          className={`toggle-button ${value === option ? 'active' : ''}`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function OrderTable({ items, onChange }) {
  function update(index, key, value) {
    onChange(items.map((item, rowIndex) => (rowIndex === index ? { ...item, [key]: value } : item)))
  }

  function addRow() {
    onChange([...items, blankItem()])
  }

  function onKeyDown(event, index) {
    if (event.key === 'Enter' && index === items.length - 1) {
      event.preventDefault()
      addRow()
      requestAnimationFrame(() => {
        document.querySelector(`[data-row="${index + 1}"][data-col="productName"]`)?.focus()
      })
    }
  }

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <table className="ledger-table min-w-[1060px] w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[28%]">商品名</th>
              <th className="w-[18%]">型式(メーカー品番)</th>
              <th className="w-[17%]">カラー／サイズ</th>
              <th className="w-[8%]">数量</th>
              <th className="w-[8%]">単位</th>
              <th className="w-[10%]">単価</th>
              <th className="w-[11%]">金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = numberValue(item.quantity) * numberValue(item.unitPrice)
              return (
                <tr key={index}>
                  <td>
                    <input data-col="productName" data-row={index} onChange={(e) => update(index, 'productName', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.productName} />
                  </td>
                  <td>
                    <input onChange={(e) => update(index, 'modelNumber', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.modelNumber} />
                  </td>
                  <td>
                    <input onChange={(e) => update(index, 'colorSize', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.colorSize} />
                  </td>
                  <td>
                    <input inputMode="numeric" onChange={(e) => update(index, 'quantity', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.quantity} />
                  </td>
                  <td>
                    <input onChange={(e) => update(index, 'unit', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.unit} />
                  </td>
                  <td>
                    <input inputMode="numeric" onChange={(e) => update(index, 'unitPrice', e.target.value)} onKeyDown={(e) => onKeyDown(e, index)} value={item.unitPrice} />
                  </td>
                  <td className="bg-slate-50 px-2 text-right font-black">{yen(amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="toggle-button no-print inline-flex w-fit items-center gap-2" onClick={addRow} type="button">
        ＋ 行追加
      </button>
    </div>
  )
}

function PrintDocument({ order, total }) {
  const printableItems = [
    ...order.items.filter((item) =>
      ['productName', 'modelNumber', 'colorSize', 'quantity', 'unit', 'unitPrice'].some((key) => item[key]),
    ),
  ]
  while (printableItems.length < 8) printableItems.push(blankItem())
  const text = (value) => value || ' '
  const orderDate = [
    order.orderDateYear ? `${order.orderDateYear}年` : '',
    order.orderDateMonth ? `${order.orderDateMonth}月` : '',
    order.orderDateDay ? `${order.orderDateDay}日` : '',
  ].filter(Boolean).join(' ')
  const catalogLabel =
    order.catalog === '他' && order.catalogOtherDetail
      ? `${order.catalog}（${order.catalogOtherDetail}）`
      : order.catalog

  return (
    <section className="print-only print-document">
      <table className="title-table">
        <colgroup>
          <col style={{ width: '72%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="sheet-title top-cell">販売受注簿</td>
            <td className="top-cell">
              <div className="stamp-grid">
                {['入荷確認', '発注者'].map((label) => (
                  <div className="stamp-box" key={label}>
                    <span>{label}</span>
                    <div></div>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="info-table">
        <colgroup>
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>受注日</th>
            <td className="value-cell">{text(orderDate)}</td>
            <th>受注区分</th>
            <td className="value-cell">{text(order.orderType)}</td>
            <th>担当営業</th>
            <td className="value-cell">{text(order.salesRepName)}</td>
            <th>納品予定日</th>
            <td className="value-cell">{text(order.deliveryDate)}</td>
          </tr>
          <tr>
            <th>売上日</th>
            <td className="value-cell">{text(order.salesDate)}</td>
            <th>売上伝票番号</th>
            <td className="value-cell">{text(order.salesSlipNumber)}</td>
            <th>依頼者（施設･居宅･ｹｱﾏﾈ等）</th>
            <td className="value-cell" colSpan="3">{text(order.requester)}</td>
          </tr>
          <tr>
            <th>顧客名</th>
            <td className="value-cell" colSpan="3">{text(order.customerName)}</td>
            <th>フリガナ</th>
            <td className="value-cell" colSpan="3">{text(order.customerKana)}</td>
          </tr>
          <tr>
            <th>住所・TEL</th>
            <td className="value-cell" colSpan="7">{text(order.addressTel)}</td>
          </tr>
        </tbody>
      </table>

      <table className="items-table">
        <colgroup>
          <col style={{ width: '29%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>商品名</th>
            <th>型式(メーカー品番)</th>
            <th>カラー／サイズ</th>
            <th>数量</th>
            <th>単位</th>
            <th>単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {printableItems.map((item, index) => {
            const amount = numberValue(item.quantity) * numberValue(item.unitPrice)
            return (
              <tr key={index}>
                <td className="value-cell">{text(item.productName)}</td>
                <td className="value-cell">{text(item.modelNumber)}</td>
                <td className="value-cell">{text(item.colorSize)}</td>
                <td className="value-cell" style={{ textAlign: 'right' }}>{text(item.quantity)}</td>
                <td className="value-cell">{text(item.unit)}</td>
                <td className="value-cell" style={{ textAlign: 'right' }}>{item.unitPrice ? yen(numberValue(item.unitPrice)) : ' '}</td>
                <td className="value-cell" style={{ textAlign: 'right' }}>{amount ? yen(amount) : ' '}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <table className="manage-table">
        <colgroup>
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>受注番号</th>
            <td className="value-cell">{text(order.orderNumber)}</td>
            <th>在庫/入荷先</th>
            <td className="value-cell">{text(order.stockArrivalType)}</td>
            <th>発注先/移動元</th>
            <td className="value-cell">{text(order.supplierOrMoveFrom)}</td>
            <th>発注番号</th>
            <td className="value-cell">{text(order.purchaseOrderNumber)}</td>
          </tr>
          <tr>
            <th>入荷日</th>
            <td className="value-cell">{text(order.arrivalDate)}</td>
            <th>発注者</th>
            <td className="value-cell"><div className="mini-stamp"></div></td>
            <th>入荷確認</th>
            <td className="value-cell"><div className="mini-stamp"></div></td>
            <th>カタログ</th>
            <td className="value-cell">{text(catalogLabel)}</td>
          </tr>
          <tr>
            <th>VOL.</th>
            <td className="value-cell">{text(order.catalogVol)}</td>
            <th>ページ</th>
            <td className="value-cell">{text(order.catalogPage)}</td>
            <th>申込№・注文ｺｰﾄﾞ</th>
            <td className="value-cell" colSpan="3">{text(order.catalogOrderCode)}</td>
          </tr>
          <tr>
            <th>販売金額内訳(税込)</th>
            <td className="amount-cell" colSpan="3">{yen(total)} 円</td>
            <th>給付額</th>
            <td className="amount-cell" colSpan="3">{order.benefitAmount ? `${yen(numberValue(order.benefitAmount))} 円` : ' '}</td>
          </tr>
        </tbody>
      </table>

      <table className="check-table">
        <tbody>
          <tr>
            <th style={{ width: '19%' }}>特定福祉用具販売・住宅改修<br />記入･チェック</th>
            <td>
              <div className="check-grid">
                {checklistOptions.map((option) => (
                  <div className="check-item" key={option}>
                    {order.checklist.includes(option) ? '■' : '□'} {option}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/* ── メインコンポーネント ─────────────────────── */
export default function JuchuBo({ staffList = [] }) {
  const [order, setOrder] = useState(blankOrder)
  const [orderId, setOrderId] = useState('')
  const [message, setMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  const staffOptions = useMemo(() => staffList.filter((n) => (n || '').trim()), [staffList])
  const total = useMemo(
    () => order.items.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice), 0),
    [order.items],
  )

  useEffect(() => {
    const payload = decodePayload(readSharedPayload())
    if (payload?.order) {
      setOrder(normalizeOrder(payload.order))
      setShareUrl(location.href)
      setMessage('共有リンクから受注データを読み込みました。')
    }
  }, [])

  function patch(key, value) {
    setOrder((current) => ({ ...current, [key]: value }))
  }

  function buildShareUrl(sourceOrder) {
    const payload = encodePayload({ order: { ...sourceOrder, totalAmount: total } })
    return `${location.origin}${location.pathname}#/order?payload=${payload}`
  }

  async function writeClipboard(url) {
    try {
      await navigator.clipboard?.writeText(url)
      return true
    } catch {
      return false
    }
  }

  function persistOrder() {
    const data = { ...order, totalAmount: total }
    const id = saveOrderLocal(data, orderId || undefined)
    setOrderId(id)
    return { id, url: buildShareUrl(data) }
  }

  // 保存＋共有URL生成（可能なら短縮）
  async function getShareUrl() {
    const { url: longUrl } = persistOrder()
    setMessage('短縮URLを生成中…')
    const short = await shortenUrl(longUrl)
    setShareUrl(short)
    return { longUrl, shortUrl: short, shortened: short !== longUrl }
  }

  async function saveOrder() {
    const { shortUrl, shortened } = await getShareUrl()
    const copied = await writeClipboard(shortUrl)
    const label = shortened ? '短縮URL' : '共有URL'
    setMessage(
      copied
        ? `保存しました。${label}をクリップボードにコピーしました。`
        : `保存しました。${label}を下に表示しました。`,
    )
  }

  async function copyLink() {
    await saveOrder()
  }

  async function createMail() {
    const { shortUrl } = await getShareUrl()
    const lines = order.items
      .filter((item) => item.productName || item.modelNumber)
      .map(
        (item) =>
          `・${item.productName} ${item.modelNumber} ${item.colorSize} 数量:${item.quantity}${item.unit} 単価:${yen(numberValue(item.unitPrice))} 金額:${yen(numberValue(item.quantity) * numberValue(item.unitPrice))}`,
      )
      .join('\n')
    const customerLine = `${order.customerName || ''}${order.customerKana ? `（${order.customerKana}）` : ''}`
    const subject = `販売受注確認 ${order.customerName || ''}`.trim()
    const body = `顧客名: ${customerLine}\n\n商品明細:\n${lines || '未入力'}\n\n合計金額: ${yen(total)}円\n\nシステム確認用リンクURL:\n${shortUrl}`
    location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <>
      <section className="screen-only app-panel mx-auto grid max-w-[1500px] gap-0 overflow-hidden rounded-lg">
        <div className="app-header flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-black tracking-normal">販売受注簿入力</h1>
            <p className="text-xs font-bold text-slate-200">データ同梱リンクで共有できます</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="total-pill">
              <span>税込合計</span>
              <strong>{yen(total)} 円</strong>
            </div>
            <button className="toggle-button" onClick={() => printDoc('landscape')} type="button">
              印刷
            </button>
            <button className="toggle-button" onClick={createMail} type="button">
              メール作成
            </button>
            <button className="toggle-button" onClick={copyLink} type="button">
              共有リンク
            </button>
            <button className="toggle-button active" onClick={saveOrder} type="button">
              保存
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-3">
          {message && <div className="rounded-md bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900">{message}</div>}
          {shareUrl && (
            <div className="share-box">
              <span className="text-xs font-black text-teal-900">共有URL</span>
              <a className="truncate text-sm font-bold text-teal-950 underline" href={shareUrl}>{shareUrl}</a>
              <button
                className="toggle-button min-h-[36px] px-3 py-1"
                onClick={async () => {
                  const copied = await writeClipboard(shareUrl)
                  setMessage(copied ? '共有リンクをクリップボードにコピーしました。' : '共有URLを表示しています。')
                }}
                type="button"
              >
                コピー
              </button>
            </div>
          )}

          <div className="section-card">
            <div className="section-heading">基本情報</div>
            <div className="grid grid-cols-12 gap-3 p-3">
              <Field className="col-span-12 md:col-span-4 xl:col-span-2" label="受注日（年・月・日）">
                <div className="grid grid-cols-3 gap-2">
                  <input className="input text-center" inputMode="numeric" onChange={(e) => patch('orderDateYear', e.target.value)} placeholder="年" value={order.orderDateYear} />
                  <input className="input text-center" inputMode="numeric" onChange={(e) => patch('orderDateMonth', e.target.value)} placeholder="月" value={order.orderDateMonth} />
                  <input className="input text-center" inputMode="numeric" onChange={(e) => patch('orderDateDay', e.target.value)} placeholder="日" value={order.orderDateDay} />
                </div>
              </Field>
              <Field className="col-span-12 md:col-span-8 xl:col-span-4" label="受注区分">
                <ToggleGroup onChange={(value) => patch('orderType', value)} options={orderTypes} value={order.orderType} />
              </Field>
              <Field className="col-span-12 xl:col-span-6" label="担当営業">
                <ToggleGroup
                  emptyText="マスタ設定から担当者を登録してください"
                  onChange={(value) => patch('salesRepName', value)}
                  options={staffOptions}
                  value={order.salesRepName}
                />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-2" label="納品予定日">
                <input className="input" onChange={(e) => patch('deliveryDate', e.target.value)} type="date" value={order.deliveryDate} />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-2" label="売上日">
                <input className="input" onChange={(e) => patch('salesDate', e.target.value)} type="date" value={order.salesDate} />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-2" label="売上伝票番号">
                <input className="input" onChange={(e) => patch('salesSlipNumber', e.target.value)} value={order.salesSlipNumber} />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-3" label="依頼者（施設･居宅･ｹｱﾏﾈ等）">
                <input className="input" onChange={(e) => patch('requester', e.target.value)} value={order.requester} />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-3" label="顧客名">
                <input className="input" onChange={(e) => patch('customerName', e.target.value)} value={order.customerName} />
              </Field>
              <Field className="col-span-12 md:col-span-4 xl:col-span-3" label="フリガナ">
                <input className="input" onChange={(e) => patch('customerKana', e.target.value)} value={order.customerKana} />
              </Field>
              <Field className="col-span-12 xl:col-span-9" label="住所・TEL">
                <input className="input" onChange={(e) => patch('addressTel', e.target.value)} value={order.addressTel} />
              </Field>
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">商品明細</div>
            <div className="p-3">
              <OrderTable items={order.items} onChange={(items) => patch('items', items)} />
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">発注・管理情報</div>
            <div className="grid grid-cols-12 gap-3 p-3">
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="受注番号">
                <input className="input" onChange={(e) => patch('orderNumber', e.target.value)} value={order.orderNumber} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="在庫/入荷先">
                <ToggleGroup onChange={(value) => patch('stockArrivalType', value)} options={stockTypes} value={order.stockArrivalType} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="発注先/移動元">
                <input className="input" onChange={(e) => patch('supplierOrMoveFrom', e.target.value)} value={order.supplierOrMoveFrom} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="発注番号">
                <input className="input" onChange={(e) => patch('purchaseOrderNumber', e.target.value)} value={order.purchaseOrderNumber} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-1" label="発注者">
                <input className="input" onChange={(e) => patch('orderer', e.target.value)} value={order.orderer} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-1" label="入荷日">
                <input className="input" onChange={(e) => patch('arrivalDate', e.target.value)} type="date" value={order.arrivalDate} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-1" label="入荷確認">
                <label className="check-tile">
                  <input checked={order.arrivalConfirmed} onChange={(e) => patch('arrivalConfirmed', e.target.checked)} type="checkbox" />
                  <span>確認済</span>
                </label>
              </Field>
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">カタログ情報</div>
            <div className="grid grid-cols-12 gap-3 p-3">
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="カタログ">
                <ToggleGroup onChange={(value) => patch('catalog', value)} options={catalogTypes} value={order.catalog} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-4" label="カタログ参照リンク">
                <div className="flex flex-wrap items-center gap-2">
                  {catalogLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
                    >
                      {link.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </Field>
              {order.catalog === '他' && (
                <Field className="col-span-12 md:col-span-6 xl:col-span-2" label="他 詳細">
                  <input className="input" onChange={(e) => patch('catalogOtherDetail', e.target.value)} value={order.catalogOtherDetail} />
                </Field>
              )}
              <Field className="col-span-12 md:col-span-3 xl:col-span-1" label="VOL.">
                <input className="input" onChange={(e) => patch('catalogVol', e.target.value)} value={order.catalogVol} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-1" label="ページ">
                <input className="input" onChange={(e) => patch('catalogPage', e.target.value)} value={order.catalogPage} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-5" label="申込№・注文ｺｰﾄﾞ">
                <input className="input" onChange={(e) => patch('catalogOrderCode', e.target.value)} value={order.catalogOrderCode} />
              </Field>
            </div>
          </div>

        </div>
      </section>
      <PrintDocument order={order} total={total} />
    </>
  )
}
