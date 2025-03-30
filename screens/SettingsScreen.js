import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Button, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';
import { useLanguage } from '../context/LanguageContext';

const SettingsScreen = ({ navigation }) => {
    const { t } = useLanguage();
    const { getThemeColors, currentTheme, changeTheme } = useTheme();
    const colors = getThemeColors();
    const [language, setLanguage] = useState('en');
    const [region, setRegion] = useState('US');
    const [isDarkMode, setIsDarkMode] = useState(currentTheme === 'dark');
    
    const handleLanguageChange = (itemValue) => setLanguage(itemValue);
    const handleRegionChange = (itemValue) => setRegion(itemValue);
    
    const toggleTheme = () => {
        const newTheme = !isDarkMode ? 'dark' : 'light';
        changeTheme(newTheme);
        setIsDarkMode(!isDarkMode);
    };
    
    const checkForUpdates = () => {
        // Simulate update check
        Alert.alert('Update Check', 'Your app is up to date.');
    };
    
    // Update isDarkMode when theme changes
    useEffect(() => {
        setIsDarkMode(currentTheme === 'dark');
    }, [currentTheme]);
    
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <ThemedText style={styles.headerTitle}>{t('settings')}</ThemedText>
            </View>
            
            <ThemedCard style={styles.settingItem}>
                <ThemedText style={styles.label}>Language</ThemedText>
                <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Picker
                        selectedValue={language}
                        onValueChange={handleLanguageChange}
                        style={styles.picker}
                        dropdownIconColor={colors.text}
                    >
                        <Picker.Item label="English" value="en" color={colors.text} />
                        <Picker.Item label="French" value="fr" color={colors.text} />
                        <Picker.Item label="Spanish" value="es" color={colors.text} />
                    </Picker>
                </View>
            </ThemedCard>
            
            <ThemedCard style={styles.settingItem}>
                <ThemedText style={styles.label}>Region</ThemedText>
                <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Picker
                        selectedValue={region}
                        onValueChange={handleRegionChange}
                        style={styles.picker}
                        dropdownIconColor={colors.text}
                    >
                        <Picker.Item label="United States" value="US" color={colors.text} />
                        <Picker.Item label="France" value="FR" color={colors.text} />
                        <Picker.Item label="Spain" value="ES" color={colors.text} />
                    </Picker>
                </View>
            </ThemedCard>
            
            <ThemedCard style={styles.settingItem}>
                <View style={styles.switchRow}>
                    <ThemedText style={styles.label}>Dark Mode</ThemedText>
                    <Switch
                        trackColor={{ false: colors.border, true: colors.primary + '80' }}
                        thumbColor={isDarkMode ? colors.primary : colors.disabled}
                        ios_backgroundColor={colors.border}
                        onValueChange={toggleTheme}
                        value={isDarkMode}
                    />
                </View>
            </ThemedCard>
            
            <ThemedCard style={styles.settingItem}>
                <Button
                    title="Check for Updates"
                    onPress={checkForUpdates}
                    color={colors.primary}
                />
            </ThemedCard>
            
            <ThemedView style={styles.settingItem}>
                <ThemedText style={styles.versionInfo}>Version: 1.0.0</ThemedText>
            </ThemedView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 20,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    settingItem: {
        marginBottom: 16,
        padding: 16,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
    },
    versionInfo: {
        fontSize: 14,
        opacity: 0.7,
        textAlign: 'center',
        marginTop: 20,
    },
});

export default SettingsScreen;
