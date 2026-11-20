import { DomainError } from '../db/core'
import { useUi, type DialogButton } from '../store/uiStore'

/** 弹窗（代替系统的 Alert.alert，写法一样）。不传按钮就只有一个“好的” */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]) {
  useUi.getState().showDialog({ title, message, buttons: buttons?.length ? buttons : [{ text: '好的' }] })
}

/** 确认框，返回用户是否点了确定（点遮罩、按返回算取消） */
export const confirm = (title: string, message: string, okText = '确定', destructive = false) =>
  new Promise<boolean>((resolve) =>
    showAlert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  )

/** 回不去的操作：危险按钮要按住约一秒半才生效（注销账号、解散家庭账本、覆盖导入） */
export const confirmHold = (title: string, message: string, okText: string) =>
  new Promise<boolean>((resolve) =>
    showAlert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', hold: true, onPress: () => resolve(true) },
    ]),
  )

/**
 * 删完底部提示“已删除 · 撤销”（5 秒），不弹确认。删成功返回 true。
 * 现在没有地方用：用户觉得一般删除不需要撤销、太复杂，但这个提示的动画不错，留着以后合适的地方用
 * （各表的 restore、txnRepo.restoreTxn、tagRepo.deleteTag / restoreTags 也留着）
 */
export function removeWithUndo(msg: string, remove: () => void, restore: () => void): boolean {
  if (!attempt(remove)) return false
  useUi.getState().showToast(msg, { label: '撤销', onPress: () => attempt(restore) })
  return true
}

/** 业务错误直接展示；其他错误给通用提示（并打印日志） */
export function showError(e: unknown) {
  if (e instanceof DomainError) return showAlert('提示', e.message)
  console.error(e)
  showAlert('出错了', '操作没有成功，请稍后再试')
}

/** 执行一个可能抛出业务错误的操作，成功返回 true */
export function attempt(fn: () => void): boolean {
  try {
    fn()
    return true
  } catch (e) {
    showError(e)
    return false
  }
}
