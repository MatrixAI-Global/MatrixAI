import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
const FeatureCardWithDetailsPro = () => {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Pro Features</Text>
                    <View style={styles.proBadge}>
                        <Text style={styles.proText}>ACTIVE</Text>
                    </View>
                </View>
            </View>
            
            <View style={styles.featuresContainer}>
                <TouchableOpacity 
                    style={styles.featureItem}
                    onPress={() => navigation.navigate('AdvancedFeatureScreen')}
                >
                   <Icon name="star" size={24} color="#4CAF50" /> 
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Advanced Voice Customization</Text>
                        <Text style={styles.featureDescription}>Customize your voice with advanced settings</Text>
                    </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.featureItem}
                    onPress={() => navigation.navigate('LongerTranscriptionsScreen')}
                >
                    <Icon name="access-time" size={24} color="#4CAF50" />
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Longer Transcriptions</Text>
                        <Text style={styles.featureDescription}>Generate longer audio-to-text conversions</Text>
                    </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.featureItem}
                    onPress={() => navigation.navigate('PriorityProcessingScreen')}
                >
                    <Icon name="speed" size={24} color="#4CAF50" />
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Priority Processing</Text>
                        <Text style={styles.featureDescription}>Get faster processing for all your AI requests</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        marginHorizontal: 10,
        marginVertical: 10,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    proBadge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 10,
    },
    proText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 10,
    },
    featuresContainer: {
        marginTop: 5,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    featureIcon: {
        width: 24,
        height: 24,
        marginRight: 15,
    },
    featureTextContainer: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    featureDescription: {
        fontSize: 12,
        color: '#777',
        marginTop: 3,
    },
});

export default FeatureCardWithDetailsPro;
