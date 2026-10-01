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
  container: { flex: 1, backgroundColor: '#09161C' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 28 },
  header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#20343B' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42 },
  brandName: { color: '#F2F6F2', fontSize: 20, fontWeight: '700' },
  signInButton: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#365158', borderRadius: 6 },
  signInText: { color: '#E5EFEC', fontSize: 14, fontWeight: '600' },
  hero: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 74, paddingBottom: 92 },
  eyebrow: { color: '#66D6C5', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  title: { maxWidth: 860, color: '#F2F5F1', fontFamily: 'Georgia', fontSize: 48, lineHeight: 59, textAlign: 'center' },
  highlight: { color: '#54D4C0' },
  description: { maxWidth: 590, color: '#A9BAC0', fontSize: 17, lineHeight: 27, textAlign: 'center', marginTop: 23 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 34 },
  primaryButton: { minWidth: 174, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, borderRadius: 6, backgroundColor: '#3CC9B5' },
  primaryButtonText: { color: '#08201F', fontSize: 15, fontWeight: '700' },
  secondaryButton: { minWidth: 190, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, borderWidth: 1, borderColor: '#365158', borderRadius: 6, backgroundColor: '#0D1D23' },
  secondaryButtonText: { color: '#E5EFEC', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.78 },
  bottomRule: { height: 1, backgroundColor: '#20343B' },
});