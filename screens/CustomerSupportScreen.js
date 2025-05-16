import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';

const FAQItem = ({ question, answer, navigation }) => {
  const [expanded, setExpanded] = useState(false);
  const animation = new Animated.Value(expanded ? 1 : 0);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const toggleExpand = () => {
    Animated.timing(animation, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const bodyHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  return (
    <TouchableOpacity 
      style={[styles.faqItem, {borderBottomColor: colors.border, backgroundColor: colors.card}]} 
      onPress={toggleExpand} 
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <ThemedText style={[styles.faqQuestion, {color: colors.text}]}>{question}</ThemedText>
        <Animated.View
          style={{
            transform: [
              {
                rotate: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons name="chevron-down" size={20} color={colors.text} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.faqBody, { height: bodyHeight }]}>
        <ThemedText style={[styles.faqAnswer, {color: colors.textSecondary || colors.text + '99'}]}>{answer}</ThemedText>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CustomerSupportScreen = ({ navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const faqs = [
    {
      question: 'How do I purchase coins?',
      answer: 'You can purchase coins from the main screen by clicking on the "Buy Coins" button. We accept various payment methods including credit cards and digital wallets.',
    },
    {
      question: 'What is Matrix AI Pro?',
      answer: 'Matrix AI Pro is our premium subscription that gives you access to advanced features, unlimited generations, and priority support.',
    },
    {
      question: 'How can I get a refund?',
      answer: 'If you are not satisfied with your purchase, you can request a refund within 7 days. Please contact our support team with your order details.',
    },
    {
      question: 'Is my payment information secure?',
      answer: 'Yes, we use industry-standard encryption and secure payment processors to protect your payment information.',
    },
  ];

  const supportOptions = [
    {
      icon: 'chatbubbles-outline',
      title: 'Give Feedback',
      description: 'Give feedback to our support team',
      action: () => navigation.navigate('FeedbackScreen'),
    },
    {
      icon: 'mail-outline',
      title: 'Email Support',
      description: 'Get help via email',
      action: () => Linking.openURL('mailto:support@matrixai.com'),
    },
  ];

  const SupportMenuItem = ({ icon, title, description, onPress }) => (
    <TouchableOpacity 
      style={[styles.menuItem, {backgroundColor: colors.card, borderBottomColor: colors.border}]} 
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <ThemedText style={[styles.menuLabel, {color: colors.text}]}>{title}</ThemedText>
        <ThemedText style={[styles.menuDescription, {color: colors.textSecondary || colors.text + '99'}]}>{description}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {backgroundColor: colors.background, borderBottomWidth: 0.8, borderColor: colors.border}]}>
        <View style={styles.headerLeftSection}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, {color: colors.text}]}>Help & Support</ThemedText>
        </View>
      </View>

      <ScrollView 
        style={[styles.content, {backgroundColor: colors.background}]} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.sectionTitle, {color: colors.text}]}>Contact Us</ThemedText>
        
        <ThemedCard style={[styles.menuContainer, {backgroundColor: colors.card, borderWidth: 0.8, borderColor: colors.border}]}>
          {supportOptions.map((option, index) => (
            <SupportMenuItem
              key={index}
              icon={option.icon}
              title={option.title}
              description={option.description}
              onPress={option.action}
            />
          ))}
        </ThemedCard>

        <ThemedText style={[styles.sectionTitle, {color: colors.text}]}>Frequently Asked Questions</ThemedText>
        
        <ThemedCard style={[styles.menuContainer, {backgroundColor: colors.card, borderWidth: 0.8, borderColor: colors.border}]}>
          {faqs.map((faq, index) => (
            <FAQItem 
              key={index} 
              question={faq.question} 
              answer={faq.answer} 
              navigation={navigation} 
            />
          ))}
        </ThemedCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 10,
    marginLeft: 10,
  },
  menuContainer: {
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    width: '100%',
  },
  iconContainer: {
    marginRight: 15,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  faqItem: {
    borderBottomWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  faqBody: {
    overflow: 'hidden',
  },
  faqAnswer: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default CustomerSupportScreen; 