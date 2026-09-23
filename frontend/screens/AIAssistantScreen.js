import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
];

const caregiverSuggestions = [
  'What medicines is this patient taking?',
  'How is this patient\'s adherence?',
  'Does this patient have missed doses?',
  'Which medicines have low supply?',
];

export default function AIAssistantScreen({
  token,
  userRole,
  patientId,
  onBack,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: initialAssistantMessage,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={styles.title}>MedSked AI</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
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
                {message.content}
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

      {suggestions.length > 0 ? (
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

      <View style={styles.inputRow}>
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
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
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
