import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthUser } from '../../hooks/useAuthUser';
import { useCoinsSubscription } from '../../hooks/useCoinsSubscription';
const TransactionScreen = ({ route, navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { uid } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.post('https://matrix-server.vercel.app/AllTransactions', {
        uid: "31ca978d-53c8-4b61-963f-fdacc2f5e9c6"
      });
      
      if (response.data.success) {
        setTransactions(response.data.data);
        // Set total coins from the latest transaction's remaining_coins
        
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
        return require('../../assets/card/music.png');
      case 'image':
        return require('../../assets/card/image.png');
      default:
        return require('../../assets/card/ppt.png');
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
      <Image source={getTransactionIcon(item.transaction_name)} style={styles.image} />
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionType}>{item.transaction_name}</Text>
        <Text style={styles.transactionSubText}>{formatDate(item.time)}</Text>
      </View>
      <View style={styles.coinsContainer}>
        <Text style={[styles.coinsText, item.status === 'success' ? styles.successText : styles.pendingText]}>
          {item.coin_amount} Coins
        </Text>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Image source={require('../../assets/back.png')} style={styles.backIcon} />
      </TouchableOpacity>

      {/* Header with full background */}
      <View style={styles.header}>
        <Image source={require('../../assets/Header.png')} style={styles.headerImage} />
        <Text style={styles.coinCount}>{coinCount} Coins</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TransactionScreen2')}>
            <Image source={require('../../assets/convert_copy.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Transaction</Text>
        </View>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WatchAdScreen')}>
            <Image source={require('../../assets/export.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Watch Ad</Text>
        </View>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('BuyCoinsScreen')}>
            <Image source={require('../../assets/money-send.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Buy Coins</Text>
        </View>
        <View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReferralScreen')}>
            <Image source={require('../../assets/add-circle.png')} style={styles.actionIcon} />
          </TouchableOpacity>
          <Text style={styles.actionText}>Invite</Text>
        </View>
      </View>

      {/* Transaction List */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.subtitle}>Last Transaction</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TransactionScreen2')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4169E1" style={styles.loader} />
      ) : (
        <FlatList
          data={transactions.slice(0, 5)}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.transactionList}
          showsVerticalScrollIndicator={false}
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
  backButton: {
    position: 'absolute',
    top: 90,
    left: 10,
    zIndex: 1,
  },
  backIcon: {
    width: 30,
    height: 30,
  },
  header: {
    position: 'relative',
    height: 200,
    marginBottom: 40,
  },
  headerImage: {
    width: '105%',
    height: '130%',
    resizeMode: 'contain',
  },
  coinCount: {
    position: 'absolute',
    top: 110,
    left: 20,
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    width: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  actionText: {
    fontSize: 14,
    color: '#4169E1',
    textAlign: 'center',
    marginTop: 5,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    color: '#FF4500',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionList: {
    marginTop: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    resizeMode: 'contain',
   
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
    color: '#666',
    textTransform: 'capitalize',
  },
});

export default TransactionScreen;
