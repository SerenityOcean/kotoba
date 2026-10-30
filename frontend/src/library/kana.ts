/**
 * 五十音卡片的数据：清音、浊音・半浊音、拗音三张表。片假名由平假名推出来（码位差 0x60），
 * 只写平假名、罗马音和字源。
 *
 * 字源是通行的说法：平假名取汉字草书，片假名取汉字的一部分。ン 的来历说法不一，不写。
 */

export type KanaTable = '清音' | '浊音' | '拗音'

export const KANA_TABLES: KanaTable[] = ['清音', '浊音', '拗音']

export interface Kana {
  hira: string
  kata: string
  romaji: string
  /** 平假名、片假名各从哪个汉字来；只有清音有 */
  from?: { hira: string; kata?: string }
}

/** 一行。空位是 null：や行、わ行在表里留着空格，对齐五个元音。 */
export interface KanaRow {
  label: string
  cells: (Kana | null)[]
}

function toKatakana(hira: string): string {
  return hira.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** 「あ:a:安:阿」→ 一张卡；「-」是空位 */
function cell(spec: string): Kana | null {
  if (spec === '-') return null
  const [hira, romaji, fromHira, fromKata] = spec.split(':')
  return {
    hira,
    kata: toKatakana(hira),
    romaji,
    from: fromHira ? { hira: fromHira, kata: fromKata || undefined } : undefined,
  }
}

function rows(spec: string): KanaRow[] {
  return spec
    .trim()
    .split('\n')
    .map((line) => {
      const [label, ...cells] = line.trim().split(/\s+/)
      return { label, cells: cells.map(cell) }
    })
}

const SEION = rows(`
  あ行 あ:a:安:阿 い:i:以:伊 う:u:宇:宇 え:e:衣:江 お:o:於:於
  か行 か:ka:加:加 き:ki:幾:幾 く:ku:久:久 け:ke:計:介 こ:ko:己:己
  さ行 さ:sa:左:散 し:shi:之:之 す:su:寸:須 せ:se:世:世 そ:so:曽:曽
  た行 た:ta:太:多 ち:chi:知:千 つ:tsu:川:川 て:te:天:天 と:to:止:止
  な行 な:na:奈:奈 に:ni:仁:二 ぬ:nu:奴:奴 ね:ne:祢:祢 の:no:乃:乃
  は行 は:ha:波:八 ひ:hi:比:比 ふ:fu:不:不 へ:he:部:部 ほ:ho:保:保
  ま行 ま:ma:末:末 み:mi:美:三 む:mu:武:牟 め:me:女:女 も:mo:毛:毛
  や行 や:ya:也:也 - ゆ:yu:由:由 - よ:yo:与:与
  ら行 ら:ra:良:良 り:ri:利:利 る:ru:留:流 れ:re:礼:礼 ろ:ro:呂:呂
  わ行 わ:wa:和:和 - - - を:wo:遠:乎
  ん ん:n - - - -
`)

const DAKUON = rows(`
  が行 が:ga ぎ:gi ぐ:gu げ:ge ご:go
  ざ行 ざ:za じ:ji ず:zu ぜ:ze ぞ:zo
  だ行 だ:da ぢ:ji づ:zu で:de ど:do
  ば行 ば:ba び:bi ぶ:bu べ:be ぼ:bo
  ぱ行 ぱ:pa ぴ:pi ぷ:pu ぺ:pe ぽ:po
`)

const YOON = rows(`
  き きゃ:kya きゅ:kyu きょ:kyo
  し しゃ:sha しゅ:shu しょ:sho
  ち ちゃ:cha ちゅ:chu ちょ:cho
  に にゃ:nya にゅ:nyu にょ:nyo
  ひ ひゃ:hya ひゅ:hyu ひょ:hyo
  み みゃ:mya みゅ:myu みょ:myo
  り りゃ:rya りゅ:ryu りょ:ryo
  ぎ ぎゃ:gya ぎゅ:gyu ぎょ:gyo
  じ じゃ:ja じゅ:ju じょ:jo
  び びゃ:bya びゅ:byu びょ:byo
  ぴ ぴゃ:pya ぴゅ:pyu ぴょ:pyo
`)

export const KANA: Record<KanaTable, KanaRow[]> = { 清音: SEION, 浊音: DAKUON, 拗音: YOON }
