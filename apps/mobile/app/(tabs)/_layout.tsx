import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#0284C7',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="diario"
        options={{
          title: 'Diário',
          tabBarIcon: ({ color }) => <TabIcon icon="📔" color={color} />,
        }}
      />
      <Tabs.Screen
        name="medicamentos"
        options={{
          title: 'Medicamentos',
          tabBarIcon: ({ color }) => <TabIcon icon="💊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
