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

export default function LandingScreen({ onSignIn, onGetStarted, onHowItWorks }) {
  return (
    <View style={styles.container}>
      <View style={styles.decorRight} />
      <View style={styles.decorLeft} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
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
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MEDICATION MANAGEMENT, SIMPLIFIED</Text>
          <Text style={styles.title}>
            Your medications, <Text style={styles.highlight}>organized</Text>
            {'\n'}— and never missed again.
          </Text>
          <Text style={styles.description}>
            MedSked keeps every dose, refill, and reminder in one calm,
            dependable place, so you can focus on feeling better.
          </Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onGetStarted}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onHowItWorks}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>See How It Works</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomRule} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#116F7A' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 28 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42 },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  signInButton: { minWidth: 82, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#0B4F59', borderRadius: 6, backgroundColor: '#0B4F59' },
  signInText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  hero: { minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingTop: 36, paddingBottom: 50 },
  eyebrow: { color: '#83DBDE', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  title: { maxWidth: 780, color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: '800', textAlign: 'center' },
  highlight: { color: '#78D6F3' },
  description: { maxWidth: 590, color: '#A7CDD0', fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 25 },
  primaryButton: { width: 160, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 6, backgroundColor: '#0B4F59' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  secondaryButton: { width: 160, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#0B4F59', borderRadius: 6, backgroundColor: 'transparent' },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  decorRight: { position: 'absolute', pointerEvents: 'none', width: 148, height: 148, borderRadius: 74, backgroundColor: '#3D929B', top: 314, right: -44 },
  decorLeft: { position: 'absolute', pointerEvents: 'none', width: 148, height: 148, borderRadius: 74, backgroundColor: '#3D929B', bottom: -54, left: -76 },
  pressed: { opacity: 0.78 },
  bottomRule: { height: 1, backgroundColor: '#3A858D' },
});