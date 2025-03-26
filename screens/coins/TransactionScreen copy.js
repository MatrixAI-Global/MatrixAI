import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthUser } from '../../hooks/useAuthUser';

const TransactionScreen2 = ({ navigation }) => {

  const { uid } = useAuthUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.post('https://matrix-server.vercel.app/AllTransactions', {
        uid: uid
      });
      
      if (response.data.success) {
        setTransactions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (transactionName) => {
    switch (transactionName.toLowerCase()) {
      case 'audio transcription':
        return 'audio-file';
      case 'image':
        return 'image';
      default:
        return 'video-file';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.iconContainer}>
        <Icon name={getTransactionIcon(item.transaction_name)} size={30} color="#4169E1" style={styles.image} />
      </View>
      <View style={styles.transactionDetails}>      
        <Text style={styles.transactionType}>{item.transaction_name}</Text>
        <Text style={styles.transactionSubText}>{formatDate(item.time)}</Text>
        <Text style={styles.balanceText}>Balance: {item.remaining_coins} coins</Text>
      </View>
      <View style={styles.coinsContainer}>
        <Text style={[styles.coinsText, item.status === 'success' ? styles.successText : styles.pendingText]}>
          {item.coin_amount} Coins
        </Text>
        <Text style={[styles.statusText, item.status === 'success' ? styles.successText : styles.pendingText]}>
          {item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../../assets/back.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4169E1" style={styles.loader} />
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.transactionList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 5,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    resizeMode: 'contain',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4169E1',
  },
  listContent: {
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {

 
  },

  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  transactionSubText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 12,
    color: '#4169E1',
    fontWeight: '500',
  },
  coinsContainer: {
    alignItems: 'flex-end',
  },
  coinsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successText: {
    color: '#4CAF50',
  },
  pendingText: {
    color: '#FFA500',
  },
  statusText: {
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
});

export default TransactionScreen2;
