import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { fonts } from '@/theme';

/**
 * Banner global "sem conexão". Aparece só quando o aparelho está claramente
 * offline (isConnected === false; null/unknown não mostra, p/ evitar flicker).
 * Tranquiliza o usuário de que os dados salvos continuam visíveis.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const net = useNetInfo();
  if (net.isConnected !== false) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, zIndex: 9998 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'center',
          backgroundColor: '#1b1a18',
          borderRadius: 999,
          borderCurve: 'continuous',
          paddingVertical: 8,
          paddingHorizontal: 14,
        }}
      >
        <WifiOff size={15} color="#ffffff" />
        <Text style={{ fontFamily: fonts.medium, color: '#ffffff', fontSize: 12.5 }}>
          Sem conexão — mostrando dados salvos
        </Text>
      </View>
    </View>
  );
}
