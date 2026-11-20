import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { panelIn } from '../../components/motion'
import { Button } from '../../components/Button'
import { CategoryGrid } from '../../components/CategoryGrid'
import { CategoryIcon } from '../../components/CategoryIcon'
import { CheckChip, IconChip, Segmented, SelectChip } from '../../components/Chip'
import { RepeatPicker } from '../../components/RepeatPicker'
import { DateField } from '../../components/DateField'
import { attempt, showAlert } from '../../components/dialogs'
import { Ellipsis } from '../../components/icons/ui'
import { Keypad } from '../../components/Keypad'
import { NavAction, NavBar } from '../../components/NavBar'
import { PhotoViewer } from '../../components/PhotoViewer'
import { Picker } from '../../components/Picker'
import { Screen } from '../../components/Screen'
import { Section } from '../../components/Section'
import { TagSheet } from '../../components/TagSheet'
import { TemplateStrip } from '../../components/TemplateStrip'
import { Txt } from '../../components/Txt'
import { budgetAlertAfterSave, deleteTemplateFlow, deleteTxnFlow, recordTemplateNow, recurringActions, templateActions, tipAfterSave, txnActions } from '../../hooks/actions'
import { useAsset, useCategories, useTemplates, useTxn, useWallets } from '../../hooks/data'
import { discardPhoto, pickPhoto, saveTxnPhoto, usePhoto } from '../../hooks/photo'
import { useUi } from '../../store/uiStore'
import { GUTTER, colors, incomeColor, radius, shadowRaised, size, space, type as typo } from '../../theme'
import { SALE_KEY, type Review, type TxnType } from '../../types/domain'
import type { StackProps } from '../../types/navigation'
import { evaluate, hasOperator, pressKey } from '../../utils/calc'
import { addDays, dayLabel, today } from '../../utils/dates'
import { freqLabel, nextDate, occurrences, periodEnd, type Repeat } from '../../utils/recurring'
import { centsToInput, formatPlain, formatYuan } from '../../utils/money'

const NO_PHOTO = { photo: null, photoFileId: null, photoCachedFor: null }

const TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '转账' },
  { value: 'refund', label: '退款' },
]

const REVIEWS: { value: Review | 'none'; label: string }[] = [
  { value: 'none', label: '未复盘' },
  { value: 'necessary', label: '必要' },
  { value: 'unnecessary', label: '非必要' },
]

const walletOptions = (ws: { id: string; name: string; liability: boolean; balanceCents: number }[]) =>
  ws.map((w) => ({ value: w.id, label: w.name, sub: w.liability ? `欠款 ${formatYuan(-w.balanceCents)}` : `余额 ${formatYuan(w.balanceCents)}` }))

/** 键盘上的日期键：今天、昨天，其余显示 11/15 */
function shortDate(d: string) {
  const t = today()
  if (d === t) return '今天'
  const y = new Date(Date.parse(`${t}T00:00:00`) - 86_400_000)
  const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
  if (d === yd) return '昨天'
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}

/**
 * 金额：用记账键盘输入时（focused），下面一道墨线、后面一个闪动的光标；写备注时变淡。
 * 点一下：收起系统输入法，回到记账键盘。打开面板、换分类时默认就是金额在输入。
 */
function AmountField({ expr, result, focused }: { expr: string; result: number | null; focused: boolean }) {
  const blink = useSharedValue(1)
  useEffect(() => {
    blink.value = focused ? withRepeat(withTiming(0, { duration: 530, reduceMotion: ReduceMotion.System }), -1, true) : 1
  }, [focused, blink])
  const caret = useAnimatedStyle(() => ({ opacity: blink.value }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`金额 ${expr || '0'}${focused ? '，正在输入' : '，点按输入金额'}`}
      onPress={() => Keyboard.dismiss()}
      hitSlop={space.xs}
      // 占满第一行右半边、整行高度，点金额附近任何地方都能回到金额
      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: space.xxs / 2, borderBottomWidth: size.bar / 2, borderBottomColor: focused ? colors.active : 'transparent' }}>
        <Txt v="amount" numberOfLines={1} adjustsFontSizeToFit color={focused && expr ? colors.ink : colors.ink3} style={{ flexShrink: 1 }}>
          {expr ? expr.replace(/-/g, '−') : '0'}
        </Txt>
        {focused ? <Animated.View style={[{ width: size.bar / 2, height: typo.amount.fontSize, marginLeft: space.xxs / 2, backgroundColor: colors.active }, caret]} /> : null}
      </View>
      {result !== null ? (
        <Txt v="caption" muted>
          = {formatPlain(result)}
        </Txt>
      ) : null}
    </Pressable>
  )
}

/** 系统键盘弹出时收起记账键盘（写备注时） */
function useKeyboardShown() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setShown(true))
    const b = Keyboard.addListener('keyboardDidHide', () => setShown(false))
    return () => {
      a.remove()
      b.remove()
    }
  }, [])
  return shown
}

export default function EntryEditPage({ navigation, route }: StackProps<'EntryEdit'>) {
  const id = route.params?.id
  // 再记一笔同样的：用那笔账预填，日期改成今天，不带家当
  const copyFrom = id ? undefined : route.params?.copyFrom
  const source = useTxn(id ?? copyFrom)
  const txn = id ? source : undefined
  const linkedAsset = useAsset(txn?.assetId ?? '')
  const wallets = useWallets()
  // 转账时连储钱罐一起（往攒钱目标里存、取）
  const transferWallets = useWallets(false, undefined, true)
  const jarIn = id ? undefined : route.params?.transferTo
  const jarOut = id ? undefined : route.params?.transferFrom
  const expenseCats = useCategories('expense')
  const incomeCats = useCategories('income').filter((c) => c.key !== SALE_KEY) // “变卖”只由家当卖出生成

  const [type, setType] = useState<TxnType>(source?.type ?? (jarIn || jarOut ? 'transfer' : 'expense'))
  const [expr, setExpr] = useState(source ? centsToInput(source.amountCents) : '')
  const [categoryId, setCategoryId] = useState<string | null>(source?.categoryId ?? null)
  const [walletId, setWalletId] = useState<string | null>(source?.walletId ?? jarOut ?? wallets[0]?.id ?? null)
  const [toWalletId, setToWalletId] = useState<string | null>(source?.toWalletId ?? jarIn ?? (jarOut ? (wallets[0]?.id ?? null) : null))
  const [date, setDate] = useState(txn?.date ?? (id ? undefined : route.params?.date) ?? today())
  const [assetOn, setAssetOn] = useState(!!txn?.assetId)
  // 备注和家当名称共用一个输入框：计入家当时它就是物品名称
  const [note, setNote] = useState((txn?.assetId ? linkedAsset?.name : undefined) ?? source?.note ?? '')
  // 家庭账本不区分“谁花的”：一家人的账记在一起，不比谁花得多（见 docs/决策.md）。
  // 编辑以前标过“谁花的”的旧账时原样保留，新记的不填
  const memberId = source?.memberId ?? null
  // 标签：再记一笔同样的也带上
  const [tags, setTags] = useState<string[]>(source?.tags ?? [])
  const [tagOpen, setTagOpen] = useState(false)
  // 重复（周期记账）：只在新记一笔的支出、收入时有
  const [repeat, setRepeat] = useState<Repeat | null>(null)
  const rule = repeat ? { ...repeat, startDate: date, endDate: null } : null
  // 小票照片：newPhoto 为 undefined 表示没动；选了新的先压缩存本机，保存时写进账目（再记一笔不带照片）
  const saved = usePhoto('transactions', id ?? '', txn ?? NO_PHOTO)
  const [newPhoto, setNewPhoto] = useState<string | null | undefined>(undefined)
  const photoUri = newPhoto === undefined ? saved.uri : newPhoto
  const [viewing, setViewing] = useState(false)
  const keyboard = useKeyboardShown()
  const [asTemplate, setAsTemplate] = useState(false)
  const templates = useTemplates()
  // 常记区和分类网格只在自己的数据变化时重画；点分类不连带重画它们（面板升起更快）
  const stripItems = useMemo(() => templates.filter((t) => t.type === type), [templates, type])
  const onRecordTemplate = useCallback(
    (t: (typeof templates)[number]) => {
      if (recordTemplateNow(t)) navigation.goBack()
    },
    [navigation],
  )
  const onManageTemplates = useCallback(() => navigation.navigate('Templates'), [navigation])
  const onTemplateLongPress = useCallback(
    (t: (typeof templates)[number]) =>
      useUi.getState().showActions({
        title: `常记「${t.name}」`,
        items: [
          { label: '编辑', onPress: () => navigation.navigate('TemplateForm', { id: t.id }) },
          { label: '删除', danger: true, onPress: () => void deleteTemplateFlow(t) },
        ],
      }),
    [navigation],
  )
  // 分类网格最后一格“添加”：直接新建一个当前类型的分类（退款用支出分类）；管理分类在掌柜里
  const onAddCategory = useCallback(() => navigation.navigate('CategoryForm', { type: type === 'income' ? 'income' : 'expense' }), [navigation, type])

  const cats = type === 'income' ? incomeCats : expenseCats
  const cat = useMemo(() => cats.find((c) => c.id === categoryId), [cats, categoryId])
  const isSale = txn?.type === 'income' && !!txn.assetId
  const reviewable = txn?.type === 'expense' && type === 'expense' && ['flex', 'want'].includes(cat?.tier ?? '')
  const close = () => navigation.goBack()
  // 不保存就离开：这次选的照片没用上，删掉本机文件
  const cancel = () => {
    if (newPhoto) discardPhoto(newPhoto)
    close()
  }
  const choosePhoto = async (src: 'camera' | 'library') => {
    const uri = await pickPhoto(`txn-${id ?? 'new'}`, src)
    if (!uri) return
    if (newPhoto) discardPhoto(newPhoto)
    setNewPhoto(uri)
  }
  const photoMenu = () =>
    useUi.getState().showActions({
      title: '小票照片',
      items: [
        ...(photoUri ? [{ label: '看大图', onPress: () => setViewing(true) }] : []),
        { label: '拍照', onPress: () => void choosePhoto('camera') },
        { label: '从相册选', onPress: () => void choosePhoto('library') },
        ...(photoUri
          ? [
              {
                label: '去掉照片',
                danger: true,
                onPress: () => {
                  if (newPhoto) discardPhoto(newPhoto)
                  setNewPhoto(null)
                },
              },
            ]
          : []),
      ],
    })

  if (id && !txn) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavBar title="这笔账" close onBack={close} />
        <Screen>
          <Txt muted>这笔账已经不存在了</Txt>
        </Screen>
      </View>
    )
  }

  if (isSale) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavBar title="这笔账" close onBack={close} />
        <Screen>
          <Section>
            <Txt>{txn.note}</Txt>
            <Txt v="amount" color={incomeColor}>
              {formatYuan(txn.amountCents, true)}
            </Txt>
            <Txt v="small" muted>
              这笔收入是家当卖出时自动生成的。要修改或删除，请到「家当」里找到这件东西，点「撤销」。
            </Txt>
          </Section>
          <Button title="去看这件家当" onPress={() => navigation.replace('AssetDetail', { id: txn.assetId! })} />
        </Screen>
      </View>
    )
  }

  const switchType = (t: TxnType) => {
    // 收入和支出的分类不通用，切换时清掉
    if ((t === 'income') !== (type === 'income')) setCategoryId(null)
    if (t !== 'expense') setAssetOn(false)
    if (t !== 'expense' && t !== 'income') setRepeat(null)
    setType(t)
  }

  const save = () => {
    const cents = evaluate(expr)
    if (cents === null || cents <= 0) return showAlert('提示', '请输入正确的金额')
    if (type !== 'transfer' && !categoryId) return showAlert('提示', '请选择分类')
    const input = {
      type,
      amountCents: cents,
      categoryId: type === 'transfer' ? null : categoryId,
      walletId: walletId ?? '',
      toWalletId: type === 'transfer' ? toWalletId : null,
      date,
      note: assetOn ? note.trim() || cat?.name || '' : note,
      asset: type === 'expense' && assetOn ? { name: note.trim() || cat?.name || '家当' } : null,
      memberId,
      tags: type === 'transfer' ? [] : tags,
    }
    let savedId = id
    const ok = attempt(() => {
      if (id) txnActions.update(id, input)
      else savedId = txnActions.create(input)
    })
    if (!ok) return
    if (newPhoto !== undefined && savedId) saveTxnPhoto(savedId, newPhoto, txn?.photo ?? null)
    // 选了重复：这一笔算第一次，以后到日子自动记（日期在以前的，补记到今天）
    const repeatMsg = !id && rule && savedId && attempt(() => recurringActions.startFromTxn(savedId!, repeat!)) ? `以后${freqLabel(rule)}自动记这一笔，在“掌柜 → 定时记账”里能改` : null
    // 勾了「存为常记」：同名的更新，没有就新建
    if (asTemplate && (type === 'expense' || type === 'income') && categoryId) {
      attempt(() =>
        templateActions.saveByName({
          name: note.trim() || cat?.name || '',
          type,
          categoryId,
          amountCents: cents,
          walletId: walletId ?? '',
          note: assetOn ? '' : note.trim(),
          memberId: input.memberId,
          tags: input.tags,
        }),
      )
    }
    const budgetMsg = type === 'expense' ? budgetAlertAfterSave(input.categoryId, date) : null
    const tip = id || type === 'transfer' ? null : tipAfterSave() // 转账（存取储钱罐）有自己的提示
    const msg = budgetMsg ?? repeatMsg ?? tip
    if (msg) useUi.getState().showToast(msg)
    if (!id) useUi.getState().showStamp() // 新记一笔：盖一枚“入账”章
    close()
  }

  const done = () => {
    if (!hasOperator(expr)) return save()
    const cents = evaluate(expr)
    setExpr(cents !== null && cents > 0 ? centsToInput(cents) : '')
  }

  // 安卓系统弹窗最多 3 个按钮，所以用自己的底部菜单
  const menu = () =>
    useUi.getState().showActions({
      title: '这笔账',
      items: [
        { label: '再记一笔同样的', onPress: () => navigation.replace('EntryEdit', { copyFrom: id! }) },
        ...(txn && (txn.type === 'expense' || txn.type === 'income')
          ? [
              { label: '存为常记', onPress: () => navigation.navigate('TemplateForm', { fromTxn: id! }) },
              { label: '设为定时记账', onPress: () => navigation.navigate('RecurringForm', { fromTxn: id! }) },
            ]
          : []),
        { label: '删除', danger: true, onPress: () => void deleteTxnFlow(txn!).then((ok) => ok && close()) },
      ],
    })

  // 日期面板最上面一排“重复”：先点重复，再点日子，按“确定”日期和重复一起定。d 是面板里点了还没确定的那天，说明跟着它变
  const canRepeat = !id && (type === 'expense' || type === 'income')
  const repeatHeader = (d: string) => {
    const r = repeat ? { ...repeat, startDate: d, endDate: null } : null
    // 这一笔算这一期（这周、这个月……）的，从下一期记起；日期在以前的，保存后补记到今天
    const doneTo = repeat ? periodEnd(repeat.freq, d) : d
    const later = r ? occurrences(r, addDays(doneTo, 1), today()).length : 0
    const next = r && !later ? nextDate(r, doneTo > today() ? doneTo : today()) : null
    return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <Txt v="small" muted style={{ lineHeight: size.chip + space.xxs }}>
          重复
        </Txt>
        <View style={{ flex: 1 }}>
          <RepeatPicker allowNone value={repeat} onChange={setRepeat} date={d} />
        </View>
      </View>
      {/* 说明固定两行高，切换重复时下面的日历不跳 */}
      <Txt v="caption" muted numberOfLines={2} style={{ minHeight: typo.caption.lineHeight * 2 }}>
        {r
          ? `${freqLabel(r)}自动记，这一笔算第一次；${later ? `保存后补记到今天，共 ${later} 笔` : next ? `下次 ${dayLabel(next)}` : ''}。`
          : '选了重复，以后到日子自动记这一笔，不用再手动记。'}
      </Txt>
    </View>
    )
  }

  const panelOpen = type === 'transfer' || !!categoryId
  const result = hasOperator(expr) ? evaluate(expr) : null
  const assetLocked = !!txn?.assetId && !!linkedAsset && linkedAsset.status !== 'holding'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        close
        onBack={cancel}
        center={
          <View style={{ alignSelf: 'stretch' }}>
            <Segmented options={TYPES} value={type} onChange={switchType} />
          </View>
        }
        right={id ? <NavAction icon={Ellipsis} label="更多" onPress={menu} /> : null}
      />

      {/* 写备注时系统输入法弹起：整块内容随键盘上移，备注框始终在输入法上方（安卓全面屏下系统不会自动处理） */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingVertical: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
        {type === 'transfer' ? (
          <Section list title="信用卡还款、借钱给别人、还别人钱，都在这里记">
            <Picker label="转出" value={walletId} options={walletOptions(transferWallets)} onChange={setWalletId} />
            <Picker label="转入" value={toWalletId} options={walletOptions(transferWallets.filter((w) => w.id !== walletId))} onChange={setToWalletId} />
          </Section>
        ) : (
          <>
            {type === 'refund' ? (
              <Txt v="small" muted>
                选退款或报销的是哪一类支出，会冲减这一类，不算收入。
              </Txt>
            ) : null}
            {/* 常记：新记一笔时放在分类上面，点一下直接记上 */}
            {!id && (type === 'expense' || type === 'income') ? (
              <TemplateStrip items={stripItems} onRecord={onRecordTemplate} onManage={onManageTemplates} onLongPress={onTemplateLongPress} />
            ) : null}
            <CategoryGrid items={cats} value={categoryId} onChange={(c) => {
                Keyboard.dismiss() // 换分类：回到金额输入
                setCategoryId(c)
              }} onAdd={onAddCategory} />
          </>
        )}
        {reviewable ? (
          <Section title="复盘：回头看，这笔是必要的吗？">
            <Segmented
              options={REVIEWS}
              value={txn?.review ?? 'none'}
              onChange={(v) => attempt(() => txnActions.review(id!, v === 'none' ? null : v))}
            />
          </Section>
        ) : null}
      </ScrollView>

      {panelOpen ? (
        <Animated.View entering={panelIn}>
        <SafeAreaView
          edges={keyboard ? [] : ['bottom']}
          style={[{ backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }, shadowRaised]}
        >
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.sm, gap: space.sm }}>
            {/* 第一行：分类图标 · 一个输入框（没输入时显示分类名，没输入就按分类名记；计入家当时就是物品名称）· 金额 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {cat ? <CategoryIcon icon={cat.icon} color={cat.color} /> : null}
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={type === 'transfer' ? '转账' : (cat?.name ?? '')}
                placeholderTextColor={colors.ink2}
                cursorColor={colors.active}
                selectionColor={colors.active}
                maxLength={assetOn ? 30 : 100}
                accessibilityLabel={assetOn ? '物品名称，不填就用分类名' : '备注，不填就用分类名'}
                style={{ flex: 1, minWidth: 0, paddingVertical: 0, paddingHorizontal: 0, fontSize: typo.body.fontSize, color: colors.ink }}
              />
              <AmountField expr={expr} result={result} focused={!keyboard} />
            </View>

            {/* 第二行：钱袋 · 家当 · 常记 · 标签，一排小胶囊（选项一律用名词），放不下横着滑；滑动区伸到屏幕边，不在边距处切断 */}
            {type !== 'transfer' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ marginHorizontal: -GUTTER }}
                contentContainerStyle={{ gap: space.xs, paddingHorizontal: GUTTER }}
              >
                <Picker
                  label={type === 'expense' ? '用哪个钱袋' : '进哪个钱袋'}
                  value={walletId}
                  options={walletOptions(wallets)}
                  onChange={setWalletId}
                  trigger={(open, cur) => <SelectChip value={cur?.label ?? '钱袋'} onPress={open} />}
                />
                {type === 'expense' ? <CheckChip label="家当" a11yLabel="计入家当" checked={assetOn} onChange={setAssetOn} /> : null}
                {type === 'expense' || type === 'income' ? (
                  <CheckChip label="常记" a11yLabel="存为常记" checked={asTemplate} onChange={setAsTemplate} />
                ) : null}
                {/* 标签、照片只放图标（参照鲨鱼记账）；有内容时后面跟着标签名、照片缩略图 */}
                <IconChip glyph="tag" label={tags.length ? `标签：${tags.join('、')}` : '标签'} active={tags.length > 0} onPress={() => setTagOpen(true)}>
                  {tags.length ? (
                    <Txt v="small" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {tags.join('、')}
                    </Txt>
                  ) : null}
                </IconChip>
                <IconChip glyph="camera" label={photoUri ? '小票照片' : '拍小票或选照片'} active={!!photoUri} onPress={photoMenu}>
                  {photoUri ? <Image source={{ uri: photoUri }} style={{ width: size.chipSm, height: size.chipSm, borderRadius: radius.xs }} /> : null}
                </IconChip>
              </ScrollView>
            ) : null}
            {assetLocked ? (
              <Txt v="caption" color={colors.gold}>
                关联的家当已经出手，金额和日期不能再改。
              </Txt>
            ) : null}
            {txn?.recurringId ? (
              recurringActions.get(txn.recurringId) ? (
                <Pressable accessibilityRole="link" onPress={() => navigation.navigate('RecurringForm', { id: txn.recurringId! })}>
                  <Txt v="caption" muted>
                    这笔是定时记账自动记的 · 去看看 ›
                  </Txt>
                </Pressable>
              ) : (
                <Txt v="caption" muted>
                  这笔是定时记账自动记的（那条定时记账已经删了）
                </Txt>
              )
            ) : null}
          </View>

          {keyboard ? null : (
            <DateField
              label="日期"
              value={date}
              onChange={setDate}
              header={canRepeat ? repeatHeader : undefined}
              trigger={(open) => (
                <Keypad
                  onKey={(k) => setExpr((e) => pressKey(e, k))}
                  dateLabel={shortDate(date)}
                  dateSub={rule ? freqLabel(rule) : undefined}
                  onDate={open}
                  doneLabel={hasOperator(expr) ? '=' : '完成'}
                  onDone={done}
                />
              )}
            />
          )}
        </SafeAreaView>
        </Animated.View>
      ) : (
        <SafeAreaView edges={['bottom']} />
      )}
      </KeyboardAvoidingView>
      <TagSheet visible={tagOpen} value={tags} onChange={setTags} onClose={() => setTagOpen(false)} />
      <PhotoViewer uri={viewing ? photoUri : null} onClose={() => setViewing(false)} />
    </View>
  )
}
