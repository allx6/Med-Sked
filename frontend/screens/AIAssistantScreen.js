import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askAiAssistant } from '../services/api';
import { colors, radius, shadow, spacing } from '../theme';

const initialAssistantMessage =
  "Hi! I’m MedSked AI. I can help you understand your medications, schedules, adherence, and refill information.";

const patientSuggestions = [
  'What medicines do I take today?',
  'What is my next dose?',
  'How is my adherence?',
  'Do I have any missed doses?',
  'Which medicines are low on supply?',
  'What are my medication expiration dates?',
];

const caregiverSuggestions = [
  'What medicines is this patient taking?',
  'How is this patient\'s adherence?',
  'Does this patient have missed doses?',
  'Which medicines have low supply?',
  "What are this patient's medication expiration dates?",
];

const formatAssistantMessage = (content) => {
  if (!content) {
    return '';
  }

  const normalized = String(content)
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();

  return normalized
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();

      if (/^[-*]\s+/.test(trimmed)) {
        return `• ${trimmed.replace(/^[-*]\s+/, '')}`;
      }

      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default function AIAssistantScreen({
  token,
  userRole,
  patientId,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: initialAssistantMessage,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [messages, loading]);

  const suggestions = userRole === 'caregiver'
    ? caregiverSuggestions
    : patientSuggestions;

  const sendMessage = async (draft = input) => {
    const trimmed = String(draft || '').trim();

    if (!trimmed || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await askAiAssistant(
        token,
        trimmed,
        userRole === 'caregiver' ? patientId : null
      );

      const answer = result?.answer ||
        'I’m here to help with your MedSked information.';

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
        },
      ]);
    } catch (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I’m sorry, I couldn’t answer that right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#D8F0F2" />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={styles.title}>MedSked AI</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.safetyNotice} accessibilityRole="summary">
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={colors.primary}
        />
        <Text style={styles.safetyNoticeText}>
          MedSked AI provides general information, not medical advice. Confirm
          treatment decisions with a licensed clinician; seek urgent care for
          emergencies.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageRow,
              message.role === 'user' ? styles.userRow : styles.assistantRow,
            ]}
          >
            <View
              style={[
                styles.bubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {message.role === 'assistant'
                  ? formatAssistantMessage(message.content)
                  : message.content}
              </Text>
            </View>
          </View>
        ))}

        {loading ? (
          <View style={[styles.messageRow, styles.assistantRow]}>
            <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!keyboardVisible && suggestions.length > 0 ? (
        <View style={styles.suggestionsWrap}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => sendMessage(suggestion)}
              disabled={loading}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && !loading && styles.suggestionPressed,
                loading && styles.suggestionDisabled,
              ]}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            paddingBottom: keyboardVisible
              ? spacing.sm
              : spacing.lg + insets.bottom,
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask MedSked AI..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={1000}
          editable={!loading}
        />

        <Pressable
          onPress={() => sendMessage()}
          disabled={loading || !String(input).trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (loading || !String(input).trim()) && styles.sendButtonDisabled,
            pressed && !loading && styles.sendButtonPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerSpacer: {
    width: 56,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  safetyNoticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  chatContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  assistantBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    backgroundColor: colors.primary,
  },
  loadingBubble: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    color: colors.text,
  },
  userText: {
    color: colors.white,
  },
  suggestionsWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestion: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionPressed: {
    opacity: 0.85,
  },
  suggestionDisabled: {
    opacity: 0.6,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    minWidth: 88,
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
  sendButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
});
