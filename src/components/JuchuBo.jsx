import { useEffect, useMemo, useState } from 'react'
import { printDoc } from '../print.js'
import BridgeAttrs from './BridgeAttrs.jsx'

/* ── 定数 ─────────────────────────────────── */
const orderTypes = ['販売', '給付', '在庫', '受領委任', '償還']
const stockTypes = ['有', '移動', '発注']
const orderSubTypes = ['自社', '直送']
const catalogTypes = ['介援隊', '夢ライフ', 'ALL LIFE', 'ナビス', '他']
// カタログ→発注先の自動補完マップ
const catalogToSupplier = {
  '介援隊': 'ケアマックス',
  '夢ライフ': 'ウェルファン',
}
const orderFormLinks = [
  { label: '介援隊 ウェブ発注', href: 'https://www.kaientai.cc/login.aspx' },
  { label: 'ウェルファン ウェブ発注', href: 'https://www.welfan.shop/' },
]
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
  orderDate: '',
  orderType: '販売',
  salesOffice: '',
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
  stockArrivalType: '発注',
  orderSubType: '自社',
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
  remarksTop: '',
  remarksBottom: '',
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
              <th className="w-[8%]">単位<span className="font-normal text-[10px] text-slate-500">（任意）</span></th>
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
            <tr>
              <td colSpan={6} className="bg-blue-50 px-3 text-right font-black text-slate-700">合計（税込）</td>
              <td className="bg-blue-50 px-2 text-right font-black text-lg">
                {yen(items.reduce((s, it) => s + numberValue(it.quantity) * numberValue(it.unitPrice), 0))} 円
              </td>
            </tr>
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
  // 空行のパディングは廃止：入力済みの行だけ印刷する
  const text = (value) => value || ' '
  const orderDate = order.orderDate
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(order.orderDate)
        return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : order.orderDate
      })()
    : ''
  const arrivalTypeLabel = order.stockArrivalType === '発注'
    ? `発注(${order.orderSubType || '自社'})`
    : (order.stockArrivalType || '')
  const catalogLabel =
    order.catalog === '他' && order.catalogOtherDetail
      ? `${order.catalog}（${order.catalogOtherDetail}）`
      : order.catalog

  return (
    <section className="print-only print-document">
      <table className="title-table">
        <tbody>
          <tr>
            <td className="sheet-title">販売受注簿</td>
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
            <th>営業所/担当</th>
            <td className="value-cell">{text([order.salesOffice, order.salesRepName].filter(Boolean).join(' / '))}</td>
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

      <table className="total-table">
        <tbody>
          <tr>
            <th style={{ width: '22%' }}>販売金額内訳(税込)</th>
            <td className="amount-cell">{yen(total)} 円</td>
          </tr>
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
            <td className="value-cell">{text(arrivalTypeLabel)}</td>
            <th>発注先/移動元</th>
            <td className="value-cell">{text(order.supplierOrMoveFrom)}</td>
            <th>発注番号</th>
            <td className="value-cell">{text(order.purchaseOrderNumber)}</td>
          </tr>
          <tr>
            <th>入荷日</th>
            <td className="value-cell">{text(order.arrivalDate)}</td>
            <th>発注者</th>
            <td className="value-cell">{text(order.orderer)}</td>
            <th>入荷確認</th>
            <td className="value-cell" style={{textAlign:'center', fontSize:'14px'}}>{order.arrivalConfirmed ? '☑' : '☐'}</td>
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
        </tbody>
      </table>

      <table className="check-table" style={{display:'none'}}>
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
export default function JuchuBo({
  master = { offices: [], staff: [], orderers: [] },
  bridge = null,
  setBridge = () => {},
}) {
  const staffList = master.staff || []
  const officeList = master.offices || []
  const ordererList = master.orderers || []
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

  /* 売上伝票発行依頼書（bridge）→ 受注簿の自動転記 */
  // 顧客名同期：bridge ⇄ 受注簿
  useEffect(() => {
    if (!bridge || !bridge.enabled) return
    if (typeof bridge.customerName === 'string' && bridge.customerName !== order.customerName) {
      setOrder((current) => ({ ...current, customerName: bridge.customerName }))
    }
  }, [bridge?.enabled, bridge?.customerName])
  useEffect(() => {
    if (!setBridge || !bridge || !bridge.enabled) return
    if ((order.customerName || '') !== (bridge.customerName || '')) {
      setBridge({ ...bridge, customerName: order.customerName || '' })
    }
  }, [order.customerName, bridge?.enabled])

  // 商品明細を bridge.items から自動生成
  useEffect(() => {
    if (!bridge || !bridge.enabled) return
    const src = Array.isArray(bridge.items) ? bridge.items.filter((it) => Number(it.amount) > 0) : []
    if (!src.length) return
    const customerForName = bridge.customerName || order.customerName || ''
    const generated = src.map((it) => {
      if (bridge.serviceType === 'housing') {
        const name = `${customerForName}様邸住宅改修（${bridge.contractor || ''}）`
        return {
          productName: name,
          modelNumber: '',
          colorSize: '',
          quantity: '1',
          unit: '式',
          unitPrice: String(Number(it.amount) || 0),
        }
      }
      return {
        productName: it.productName || '',
        modelNumber: '',
        colorSize: it.color || '',
        quantity: '1',
        unit: '',
        unitPrice: String(Number(it.amount) || 0),
      }
    })
    const same =
      order.items.length === generated.length &&
      order.items.every((c, i) => {
        const g = generated[i]
        return (
          c.productName === g.productName &&
          c.unitPrice === g.unitPrice &&
          c.unit === g.unit &&
          c.quantity === g.quantity &&
          c.colorSize === g.colorSize &&
          c.modelNumber === g.modelNumber
        )
      })
    if (!same) {
      setOrder((current) => ({ ...current, items: generated }))
    }
  }, [bridge?.enabled, bridge?.serviceType, bridge?.contractor, bridge?.customerName, JSON.stringify(bridge?.items || [])])

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

  async function saveOrder() {
    const { url } = persistOrder()
    setShareUrl(url)
    const copied = await writeClipboard(url)
    setMessage(
      copied
        ? '共有URLをクリップボードにコピーしました。'
        : '共有URLを下に表示しました。',
    )
  }

  async function copyLink() {
    await saveOrder()
  }

  function createMail() {
    // メール用は短縮しない長いURLをそのまま使用（URL自体が状態を保持）
    const { url: longUrl } = persistOrder()
    setShareUrl(longUrl)
    const subject = `販売受注のご依頼 ${order.customerName || ''}`.trim()
    const body = `お疲れ様です。\n下記URLの通り、発注をお願いいたします。\n\n${longUrl}\n`
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
            <button className="toggle-button" onClick={() => printDoc('landscape')} type="button">
              印刷
            </button>
            <button className="toggle-button" onClick={createMail} type="button">
              メール作成
            </button>
            <button className="toggle-button" onClick={copyLink} type="button">
              共有リンク
            </button>
            <button
              className="toggle-button !border-red-300 !text-red-700 hover:!bg-red-50"
              onClick={() => {
                if (window.confirm('入力内容をすべて削除します。よろしいですか？')) {
                  setOrder(blankOrder())
                  setOrderId('')
                  setShareUrl('')
                  setMessage('入力内容を削除しました。')
                }
              }}
              type="button"
            >
              空白の状態に戻す
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
              <Field className="col-span-12 md:col-span-4 xl:col-span-2" label="受注日">
                <input
                  className="input"
                  type="date"
                  value={order.orderDate}
                  onChange={(e) => patch('orderDate', e.target.value)}
                />
              </Field>
              <Field className="col-span-12 md:col-span-8 xl:col-span-4" label="受注区分">
                <ToggleGroup onChange={(value) => patch('orderType', value)} options={orderTypes} value={order.orderType} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="営業所">
                <select
                  className="input"
                  value={order.salesOffice}
                  onChange={(e) => patch('salesOffice', e.target.value)}
                >
                  <option value="">{officeList.length ? '選択' : '（マスタ未登録）'}</option>
                  {officeList.filter((n) => (n || '').trim()).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field className="col-span-12 xl:col-span-3" label="営業担当">
                <ToggleGroup
                  emptyText="マスタ設定から営業担当を登録してください"
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
              <Field className="col-span-12 md:col-span-8 xl:col-span-6" label="依頼者（施設･居宅･ｹｱﾏﾈ等）">
                <input className="input" onChange={(e) => patch('requester', e.target.value)} value={order.requester} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-6" label="顧客名">
                <input className="input" onChange={(e) => patch('customerName', e.target.value)} value={order.customerName} />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-6" label="フリガナ">
                <input className="input" onChange={(e) => patch('customerKana', e.target.value)} value={order.customerKana} />
              </Field>
              <Field className="col-span-12 xl:col-span-12" label="住所・TEL">
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
              <Field className="col-span-12 md:col-span-6 xl:col-span-4" label="在庫/入荷先">
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup onChange={(value) => patch('stockArrivalType', value)} options={stockTypes} value={order.stockArrivalType} />
                  {order.stockArrivalType === '発注' && (
                    <ToggleGroup onChange={(value) => patch('orderSubType', value)} options={orderSubTypes} value={order.orderSubType} />
                  )}
                </div>
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="発注先/移動元">
                <input className="input" onChange={(e) => patch('supplierOrMoveFrom', e.target.value)} value={order.supplierOrMoveFrom} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="発注番号">
                <input className="input" onChange={(e) => patch('purchaseOrderNumber', e.target.value)} value={order.purchaseOrderNumber} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="発注者">
                <input
                  className="input"
                  list="juchu-orderer-list"
                  onChange={(e) => patch('orderer', e.target.value)}
                  value={order.orderer}
                />
                <datalist id="juchu-orderer-list">
                  {ordererList.filter((n) => (n || '').trim()).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="入荷日">
                <input className="input" onChange={(e) => patch('arrivalDate', e.target.value)} type="date" value={order.arrivalDate} />
              </Field>
              <Field className="col-span-12 md:col-span-3 xl:col-span-2" label="入荷確認">
                <label className="check-tile">
                  <input checked={order.arrivalConfirmed} onChange={(e) => patch('arrivalConfirmed', e.target.checked)} type="checkbox" />
                  <span>確認済</span>
                </label>
              </Field>
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">備考（申込情報・上段）</div>
            <div className="p-3">
              <textarea
                className="input min-h-[60px]"
                rows={2}
                placeholder="申込情報に関する備考を入力"
                value={order.remarksTop}
                onChange={(e) => patch('remarksTop', e.target.value)}
              />
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">カタログ情報</div>
            <div className="grid grid-cols-12 gap-3 p-3">
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="カタログ">
                <ToggleGroup
                  onChange={(value) => {
                    setOrder((current) => {
                      const next = { ...current, catalog: value }
                      const auto = catalogToSupplier[value]
                      // 発注先が空、または前回の自動補完値だった場合は上書き（手入力は尊重）
                      if (auto && (!current.supplierOrMoveFrom || Object.values(catalogToSupplier).includes(current.supplierOrMoveFrom))) {
                        next.supplierOrMoveFrom = auto
                      }
                      return next
                    })
                  }}
                  options={catalogTypes}
                  value={order.catalog}
                />
              </Field>
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="カタログ参照リンク">
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
              <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="ウェブ発注フォーム">
                <div className="flex flex-col gap-1">
                  {orderFormLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition"
                    >
                      {link.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </Field>
              {order.catalog === '他' && (
                <Field className="col-span-12 md:col-span-6 xl:col-span-3" label="他 詳細">
                  <input className="input" onChange={(e) => patch('catalogOtherDetail', e.target.value)} value={order.catalogOtherDetail} />
                </Field>
              )}
              {/* VOL./ページ/注文コードはひとまとめにして近接配置 */}
              <div className="col-span-12 grid grid-cols-12 gap-3 rounded-md bg-slate-50 p-2">
                <Field className="col-span-4 md:col-span-2 xl:col-span-1" label="VOL.">
                  <input className="input" onChange={(e) => patch('catalogVol', e.target.value)} value={order.catalogVol} />
                </Field>
                <Field className="col-span-4 md:col-span-2 xl:col-span-1" label="ページ">
                  <input className="input" onChange={(e) => patch('catalogPage', e.target.value)} value={order.catalogPage} />
                </Field>
                <Field className="col-span-12 md:col-span-4 xl:col-span-3" label="申込№・注文ｺｰﾄﾞ">
                  <input className="input" onChange={(e) => patch('catalogOrderCode', e.target.value)} value={order.catalogOrderCode} />
                </Field>
              </div>
            </div>
          </div>

          {bridge && (
            <div className={`section-card border-2 ${bridge.enabled ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-300'}`}>
              <div
                className="px-4 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200"
              >
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-6 h-6 accent-blue-600"
                    checked={Boolean(bridge.enabled)}
                    onChange={(e) => setBridge({ ...bridge, enabled: e.target.checked })}
                  />
                  <span className="text-base md:text-lg font-extrabold text-slate-800">
                    住宅改修・特定福祉用具として売上伝票発行依頼書へ自動転記する
                  </span>
                </label>
              </div>
              {bridge.enabled && (
                <div className="p-4">
                  <BridgeAttrs bridge={bridge} setBridge={setBridge} />
                  <p className="mt-3 text-xs text-slate-500">
                    ※ ここで入力した内容は「売上伝票発行依頼書」タブに自動転記されます。
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="section-card">
            <div className="section-heading">備考（最下段）</div>
            <div className="p-3">
              <textarea
                className="input min-h-[80px]"
                rows={3}
                placeholder="その他連絡事項などの備考"
                value={order.remarksBottom}
                onChange={(e) => patch('remarksBottom', e.target.value)}
              />
            </div>
          </div>

        </div>
      </section>
      <PrintDocument order={order} total={total} />
    </>
  )
}
