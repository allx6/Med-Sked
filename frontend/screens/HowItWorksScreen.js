import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
  const entranceProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(entranceProgress, {
      toValue: 1,
      duration: 360,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [entranceProgress]);

  const entranceStyle = {
    opacity: entranceProgress,
    transform: [
      {
        translateY: entranceProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

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

        <Animated.View style={[styles.content, entranceStyle]}>
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
        </Animated.View>
        <View style={styles.bottomRule} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#116F7A' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 28 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#3A858D' },
  backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: '#D8F0F2', fontSize: 14, fontWeight: '600' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42 },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  content: { width: '100%', flexGrow: 1, justifyContent: 'center', paddingTop: 54, paddingBottom: 64 },
  eyebrow: { color: '#83DBDE', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  title: { maxWidth: 760, alignSelf: 'center', color: '#FFFFFF', fontSize: 32, lineHeight: 38, fontWeight: '800', textAlign: 'center', marginBottom: 48 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 28 },
  step: { flexGrow: 1, flexBasis: 210, maxWidth: 350, minWidth: 0, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#43878D' },
  numberCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#237F89', marginBottom: 16 },
  number: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stepTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  description: { color: '#A7CDD0', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.75 },
  bottomRule: { height: 1, backgroundColor: '#3A858D' },
});