import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TouchableWithoutFeedback,
  SectionList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
const LeftNavbarBot = ({ chats, onSelectChat, onNewChat, onClose, onDeleteChat }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  // Group chats by time (Today, Yesterday, Last Week, Older)
  const groupedChats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const lastWeek = today - 7 * 24 * 60 * 60 * 1000;

    // Create sections
    const sections = [
      { title: 'Today', data: [] },
      { title: 'Yesterday', data: [] },
      { title: 'Last Week', data: [] },
      { title: 'Older', data: [] }
    ];

    // Sort chats into respective sections
    chats.forEach(chat => {
      // Try multiple sources for timestamp:
      // 1. updated_at from database
      // 2. created_at from database
      // 3. Last message timestamp
      // 4. Chat ID (which is often a timestamp)
      let timestamp;
      
      if (chat.updated_at) {
        // Database updated_at field
        timestamp = new Date(chat.updated_at).getTime();
      } else if (chat.created_at) {
        // Database created_at field
        timestamp = new Date(chat.created_at).getTime();
      } else if (chat.messages && chat.messages.length > 0) {
        // Get timestamp from the last message
        const lastMessage = chat.messages[chat.messages.length - 1];
        if (lastMessage.timestamp) {
          timestamp = new Date(lastMessage.timestamp).getTime();
        }
      }
      
      // If no timestamp found yet, try to use the chat ID
      if (!timestamp && chat.id) {
        // Try to parse the ID as a number (it's often a timestamp)
        const idNum = parseInt(chat.id, 10);
        if (!isNaN(idNum) && idNum > 1000000000000) { // Basic check that it's a reasonable timestamp (after 2001)
          timestamp = idNum;
        }
      }
      
      // If we still don't have a timestamp, use current time
      if (!timestamp) {
        timestamp = Date.now();
      }
      
      // Sort into appropriate section
      if (timestamp >= today) {
        sections[0].data.push(chat);
      } else if (timestamp >= yesterday) {
        sections[1].data.push(chat);
      } else if (timestamp >= lastWeek) {
        sections[2].data.push(chat);
      } else {
        sections[3].data.push(chat);
      }
    });

    // Sort chats within each section by timestamp (newest first)
    sections.forEach(section => {
      section.data.sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 
                    parseInt(a.id, 10) || 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 
                    parseInt(b.id, 10) || 0;
        return bTime - aTime; // Descending order (newest first)
      });
    });

    // Filter out empty sections
    return sections.filter(section => section.data.length > 0);
  }, [chats]);

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <SafeAreaView style={[styles.sidebar, { backgroundColor: colors.card }]}>
        {/* Header of Sidebar */}
        <View style={styles.header}>
        
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* List of Chats grouped by time */}
        {chats.length > 0 ? (
          <SectionList
            sections={groupedChats}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.chatItemContainer, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={styles.chatContent}
                  onPress={() => onSelectChat(item.id)}
                >
                  <Text style={[styles.chatName, { color: colors.text }]}>{item.name}</Text>
                  {item.role && (
                    <Text style={styles.chatRole}>Role: {item.role}</Text>
                  )}
                  <Text style={styles.chatDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDeleteChat(item.id)}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF0000" />
                </TouchableOpacity>
              </View>
            )}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color="#4C8EF7" />
            <Text style={styles.emptyStateText}>No chats yet</Text>
            <Text style={styles.emptyStateSubText}>Start a new conversation to begin chatting</Text>
          </View>
        )}
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  chatContent: {
    flex: 1,
  },
  deleteButton: {
    marginLeft: 10,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '75%',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionHeader: {
    backgroundColor: '#f0f7ff',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4C8EF7',
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4C8EF7',
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatRole: {
    fontSize: 14,
    color: '#4C8EF7',
    fontWeight: '500',
    marginTop: 2,
  },
  chatDescription: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4C8EF7',
    marginBottom: 10,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#666',
  },
});

export default LeftNavbarBot;
