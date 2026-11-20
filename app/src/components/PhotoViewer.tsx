import { Image, Modal, Pressable } from 'react-native'
import { colors } from '../theme'

/** 看大图：黑底铺满，点一下或按返回关掉 */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} style={{ flex: 1, backgroundColor: colors.black }}>
        {uri ? <Image source={{ uri }} resizeMode="contain" style={{ flex: 1 }} accessibilityLabel="照片" /> : null}
      </Pressable>
    </Modal>
  )
}
