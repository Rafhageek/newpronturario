import { Tabs } from 'expo-router';
import { HubPatientsTabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <HubPatientsTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="diario" />
      <Tabs.Screen name="medicamentos" />
      <Tabs.Screen name="mais" />
      {/* Fora da barra (acessível pela aba "Mais" / navegação) */}
      <Tabs.Screen name="perfil" options={{ href: null }} />
    </Tabs>
  );
}
