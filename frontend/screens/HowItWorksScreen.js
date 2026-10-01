import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const medSkedLogo = require('../assets/medsked.png');

const steps = [
  {
    number: '1',
    title: 'Add your medications',
    description: 'Enter dosage, frequency, and how many you have on hand - takes under a minute.',
  },
  {
    number: '2',
    title: 'Set your schedule',
    description: 'Pick the days and times, and MedSked handles reminders across your devices.',
  },
  {
    number: '3',
    title: 'Stay on track',
    description: 'Log doses in one tap, watch your adherence, and get alerted before a refill runs out.',
  },
];

export default function HowItWorksScreen({ onBack }) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <View style={styles.brand}>
            <Image
              accessible
              accessibilityLabel="MedSked logo"
              source={medSkedLogo}
              resizeMode="contain"
              style={styles.logo}
            />
            <Text style={styles.brandName}>MedSked</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>HOW IT WORKS</Text>
          <Text style={styles.title}>Three steps to a routine that sticks.</Text>

          <View style={styles.steps}>
            {steps.map((step) => (
              <View key={step.number} style={styles.step}>
                <View style={styles.numberCircle}>
                  <Text style={styles.number}>{step.number}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.bottomRule} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09161C' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 28 },
  header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#20343B' },
  backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: '#D8E6E3', fontSize: 14, fontWeight: '600' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42 },
  brandName: { color: '#F2F6F2', fontSize: 20, fontWeight: '700' },
  content: { width: '100%', flexGrow: 1, justifyContent: 'center', paddingTop: 68, paddingBottom: 82 },
  eyebrow: { color: '#66D6C5', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  title: { maxWidth: 760, alignSelf: 'center', color: '#F2F5F1', fontFamily: 'Georgia', fontSize: 42, lineHeight: 52, textAlign: 'center', marginBottom: 58 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 28 },
  step: { flexGrow: 1, flexBasis: 230, maxWidth: 350, minWidth: 0, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#365158' },
  numberCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#123B3B', marginBottom: 22 },
  number: { color: '#66D6C5', fontSize: 16, fontWeight: '700' },
  stepTitle: { color: '#F2F5F1', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  description: { color: '#A9BAC0', fontSize: 15, lineHeight: 24 },
  pressed: { opacity: 0.75 },
  bottomRule: { height: 1, backgroundColor: '#20343B' },
});