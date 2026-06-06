import { Text, TextInput, Pressable, View, type TextInputProps } from 'react-native';

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'accent';
}) {
  const bg = variant === 'accent' ? 'bg-accent' : 'bg-primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 items-center justify-center rounded-xl ${bg} ${disabled ? 'opacity-60' : ''}`}
    >
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; error?: string }) {
  const { label, error, ...rest } = props;
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-neutral-700">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94A3B8"
        className="h-12 rounded-xl border border-neutral-200 px-3 text-base text-neutral-900"
        {...rest}
      />
      {error ? <Text className="text-xs text-semaphore-alert">{error}</Text> : null}
    </View>
  );
}

export function Card({ children, dashed }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <View
      className={`rounded-2xl border bg-white p-4 ${dashed ? 'border-dashed border-neutral-300' : 'border-neutral-200'}`}
    >
      {children}
    </View>
  );
}
