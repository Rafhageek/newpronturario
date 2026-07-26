import { View, Text, ScrollView } from 'react-native';
import { buildMoodGrid, moodPixelColor, MOOD_PIXEL_LABEL } from '@hubpatients/core';
import { useDiaryEntries } from '@hubpatients/supabase';
import { Card } from '@/components/ui';
import { useColors, fonts } from '@/theme';

const CELL = 11;
const GAP = 3;

/** "Ano em cores" (mobile) — cada dia é um pixel colorido pelo humor do diário. */
export function MoodYearMap({ patientId }: { patientId?: string }) {
  const colors = useColors();
  const { data: entries = [] } = useDiaryEntries(patientId);
  const moodByDate = new Map<string, number>();
  entries.forEach((e) => {
    if (e.mood != null) moodByDate.set(e.entry_date, e.mood);
  });
  const now = new Date();
  const endIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weeks = buildMoodGrid(endIso, 182);
  const hasData = moodByDate.size > 0;

  return (
    <Card className="gap-3">
      <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
        Seu ano em cores
      </Text>

      {!hasData ? (
        <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
          Registre como você se sente no Diário para ver o mapa do seu ano. 💙
        </Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row" style={{ gap: GAP }}>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ gap: GAP }}>
                  {week.map((date, di) => {
                    const color = date ? moodPixelColor(moodByDate.get(date)) : null;
                    return <View key={di} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: color ?? colors.surface2 }} />;
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
            {[1, 2, 3, 4, 5].map((m) => (
              <View key={m} className="flex-row items-center" style={{ gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: moodPixelColor(m) as string }} />
                <Text style={{ fontFamily: fonts.regular }} className="text-[10px] text-muted">
                  {MOOD_PIXEL_LABEL[m]}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}
