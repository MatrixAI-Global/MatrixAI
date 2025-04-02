import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
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
      let timestamp;
      
      if (chat.updated_at) {
        timestamp = new Date(chat.updated_at).getTime();
      } else if (chat.created_at) {
        timestamp = new Date(chat.created_at).getTime();
      } else if (chat.messages && chat.messages.length > 0) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        if (lastMessage.timestamp) {
          timestamp = new Date(lastMessage.timestamp).getTime();
        }
      }
      
      if (!timestamp && chat.id) {
        const idNum = parseInt(chat.id, 10);
        if (!isNaN(idNum) && idNum > 1000000000000) {
          timestamp = idNum;
        }
      }
      
      if (!timestamp) {
        timestamp = Date.now();
      }
      
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

    sections.forEach(section => {
      section.data.sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 
                    parseInt(a.id, 10) || 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 
                    parseInt(b.id, 10) || 0;
        return bTime - aTime;
      });
    });

    return sections.filter(section => section.data.length > 0);
  }, [chats]);

  const renderSection = ({ item }) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{item.title}</Text>
      {item.data.map((chat) => (
        <View key={chat.id} style={[styles.chatItemContainer, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.chatContent}
            onPress={() => onSelectChat(chat.id)}
          >
            <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
            {chat.role && (
              <Text style={styles.chatRole}>Role: {chat.role}</Text>
            )}
            <Text style={styles.chatDescription} numberOfLines={1}>
              {chat.description}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeleteChat(chat.id)}
          >
            <Ionicons name="trash-outline" size={24} color="#FF0000" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.sidebar, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      {chats.length > 0 ? (
        <FlatList
          data={groupedChats}
          renderItem={renderSection}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color="#4C8EF7" />
          <Text style={styles.emptyStateText}>No chats yet</Text>
          <Text style={styles.emptyStateSubText}>Start a new conversation to begin chatting</Text>
        </View>
      )}
    </SafeAreaView>
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
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4C8EF7',
    marginBottom: 10,
    paddingLeft: 5,
  },
  listContainer: {
    paddingBottom: 20,
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
